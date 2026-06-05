#!/usr/bin/env python3
"""
Headstone Scanner — MemorialSpace CLI tool
==========================================
Scans headstone images using Anthropic Claude vision API.
For each image it extracts: names, dates of birth/death, inscription text.

Usage:
    python scripts/headstone_scanner.py [image_paths...] [options]

Options:
    --cemetery-id INT   Target cemetery / organization ID (required for upload)
    --api-url URL       MemorialSpace API base URL (default: http://localhost:5000)
    --api-key KEY       Anthropic API key (falls back to ANTHROPIC_API_KEY env var)
    --output FILE       Write JSON results to this file instead of stdout
    --upload            POST scanned results to the MemorialSpace API server
    --qr                Detect QR codes in images (requires pyzbar or zxing-cpp)
    --help              Show this help

Examples:
    python scripts/headstone_scanner.py photos/*.jpg --cemetery-id 1 --upload
    python scripts/headstone_scanner.py photos/stone.jpg --output results.json
    python scripts/headstone_scanner.py photos/stone.jpg --qr
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

# ─── QR detection (optional dependency) ──────────────────────────────────────

def _try_import_qr():
    """Return a QR decode function, or None if no library is available."""
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode  # type: ignore
        from PIL import Image  # type: ignore
        def decode_qr_pyzbar(image_path: str) -> list[str]:
            img = Image.open(image_path)
            return [obj.data.decode("utf-8", errors="replace") for obj in pyzbar_decode(img)]
        return decode_qr_pyzbar
    except ImportError:
        pass

    try:
        import zxingcpp  # type: ignore
        from PIL import Image  # type: ignore
        def decode_qr_zxing(image_path: str) -> list[str]:
            img = Image.open(image_path)
            results = zxingcpp.read_barcodes(img)
            return [r.text for r in results]
        return decode_qr_zxing
    except ImportError:
        pass

    return None


# ─── Anthropic helpers ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You extract cemetery headstone inscriptions from images.

Return ONLY JSON. Do not include markdown fences.

Schema:
{
  "inscriptionText": "all readable inscription text, newlines allowed",
  "isFamilyHeadstone": false,
  "people": [
    { "name": "Full name", "dateOfBirth": "YYYY-MM-DD or YYYY or null", "dateOfDeath": "YYYY-MM-DD or YYYY or null" }
  ],
  "confidence": 0.0,
  "warnings": ["short uncertainty notes"]
}

Rules:
- Add one people[] entry per person visible on the stone.
- isFamilyHeadstone = true when multiple people, shared surname, or family plot wording.
- Normalize obvious dates to YYYY-MM-DD; otherwise YYYY or null.
- Do not invent names or dates. Use warnings for uncertain text."""


def _read_image_b64(path: str) -> tuple[str, str]:
    """Return (media_type, base64_data) for a local image file."""
    mime, _ = mimetypes.guess_type(path)
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        mime = "image/jpeg"
    with open(path, "rb") as fh:
        data = base64.standard_b64encode(fh.read()).decode("ascii")
    return mime, data


def _anthropic_scan(image_path: str, api_key: str) -> dict[str, Any]:
    """Call Anthropic Messages API directly (no SDK dependency)."""
    mime, b64data = _read_image_b64(image_path)
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1200,
        "temperature": 0,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": mime, "data": b64data},
                    },
                    {
                        "type": "text",
                        "text": f"Extract the deceased names and dates from this headstone. Filename: {Path(image_path).name}",
                    },
                ],
            }
        ],
    }

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Anthropic API error {exc.code}: {detail}") from exc

    text = "".join(
        b["text"] for b in body.get("content", []) if b.get("type") == "text"
    ).strip()
    # Strip markdown fences if the model added them despite instructions
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise RuntimeError(f"Anthropic returned non-JSON output:\n{text[:300]}")


# ─── Server upload ────────────────────────────────────────────────────────────

def _upload_to_server(
    rows: list[dict[str, Any]],
    cemetery_id: int,
    api_url: str,
) -> dict[str, Any]:
    """POST scan results to the MemorialSpace headstone-import analyze endpoint."""
    # Build image inputs from stored b64 data (scanner keeps them in memory)
    image_inputs = [
        {"fileName": r["imageFileName"], "dataUrl": r["_dataUrl"]}
        for r in rows
        if r.get("_dataUrl")
    ]
    payload = {"images": image_inputs, "cemeteryId": cemetery_id}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/headstone-import/analyze",
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Server error {exc.code}: {detail}") from exc


# ─── Main logic ───────────────────────────────────────────────────────────────

def scan_images(
    paths: list[str],
    api_key: str,
    qr_decode_fn: Any,
    verbose: bool = True,
) -> list[dict[str, Any]]:
    results = []
    for path in paths:
        if not os.path.isfile(path):
            print(f"  [SKIP] {path} — file not found", file=sys.stderr)
            continue

        file_name = Path(path).name
        if verbose:
            print(f"  Scanning {file_name}…", end=" ", flush=True)

        result: dict[str, Any] = {
            "imageFileName": file_name,
            "imagePath": path,
            "people": [],
            "isFamilyHeadstone": False,
            "inscriptionText": "",
            "confidence": 0.0,
            "warnings": [],
            "qrCodes": [],
        }

        # QR detection
        if qr_decode_fn:
            try:
                result["qrCodes"] = qr_decode_fn(path)
            except Exception as exc:
                result["warnings"].append(f"QR scan failed: {exc}")

        # AI scan
        try:
            ai = _anthropic_scan(path, api_key)
            result["people"] = ai.get("people", [])
            result["isFamilyHeadstone"] = bool(ai.get("isFamilyHeadstone", False))
            result["inscriptionText"] = str(ai.get("inscriptionText", "")).strip()
            result["confidence"] = float(ai.get("confidence", 0))
            result["warnings"] += ai.get("warnings", [])
            result["status"] = "ready" if result["people"] else "needs_review"
        except Exception as exc:
            result["status"] = "error"
            result["warnings"].append(f"AI scan failed: {exc}")

        # Keep data URL for optional server upload
        mime, b64data = _read_image_b64(path)
        result["_dataUrl"] = f"data:{mime};base64,{b64data}"

        if verbose:
            names = ", ".join(p.get("name", "?") for p in result["people"]) or "(none)"
            qrs = f" | QR:{len(result['qrCodes'])}" if result["qrCodes"] else ""
            print(f"✓  {names} (conf={result['confidence']:.0%}){qrs}")

        results.append(result)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="headstone_scanner.py",
        description="Scan headstone images with Anthropic Claude vision API.",
        add_help=True,
    )
    parser.add_argument("images", nargs="*", help="Image file paths to scan")
    parser.add_argument("--cemetery-id", type=int, default=None)
    parser.add_argument("--api-url", default="http://localhost:5000")
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--output", default=None, help="Write JSON output to file")
    parser.add_argument("--upload", action="store_true", help="Upload results to API server")
    parser.add_argument("--qr", action="store_true", help="Enable QR code detection")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress output")

    args = parser.parse_args()

    if not args.images:
        parser.print_help()
        return 0

    # Resolve API key
    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("Error: Anthropic API key required. Set ANTHROPIC_API_KEY or pass --api-key.", file=sys.stderr)
        return 1

    # QR decoder
    qr_fn = None
    if args.qr:
        qr_fn = _try_import_qr()
        if qr_fn is None:
            print("Warning: QR detection requested but neither pyzbar nor zxing-cpp is installed.", file=sys.stderr)
            print("  Install with: pip install pyzbar Pillow  OR  pip install zxing-cpp Pillow", file=sys.stderr)

    # Expand globs / directories
    resolved_paths: list[str] = []
    for pattern in args.images:
        p = Path(pattern)
        if p.is_dir():
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
                resolved_paths.extend(str(f) for f in p.glob(ext))
        else:
            resolved_paths.append(pattern)

    if not resolved_paths:
        print("No image files found.", file=sys.stderr)
        return 1

    verbose = not args.quiet
    if verbose:
        print(f"MemorialSpace Headstone Scanner — {len(resolved_paths)} image(s)")
        if args.qr and qr_fn:
            print("QR detection: enabled")
        print()

    results = scan_images(resolved_paths, api_key, qr_fn, verbose=verbose)

    # Strip internal _dataUrl from public output unless uploading
    public_results = []
    for r in results:
        pub = {k: v for k, v in r.items() if k != "_dataUrl"}
        public_results.append(pub)

    # Upload to server
    if args.upload:
        if not args.cemetery_id:
            print("Error: --cemetery-id is required when using --upload.", file=sys.stderr)
            return 1
        if verbose:
            print(f"\nUploading {len(results)} result(s) to {args.api_url}…")
        try:
            server_resp = _upload_to_server(results, args.cemetery_id, args.api_url)
            if verbose:
                print(f"Server response: {json.dumps(server_resp, indent=2)}")
        except RuntimeError as exc:
            print(f"Upload failed: {exc}", file=sys.stderr)
            return 1

    # Output results
    output_data = {
        "scanned": len(results),
        "ready": sum(1 for r in public_results if r.get("status") == "ready"),
        "needs_review": sum(1 for r in public_results if r.get("status") == "needs_review"),
        "errors": sum(1 for r in public_results if r.get("status") == "error"),
        "results": public_results,
    }

    output_json = json.dumps(output_data, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        if verbose:
            print(f"\nResults written to {args.output}")
    else:
        print(output_json)

    return 0


if __name__ == "__main__":
    sys.exit(main())
