import { Link } from "wouter";
import { ArrowRight, BookImage, FileSpreadsheet, GitMerge, ScanText, Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const importOptions = [
  {
    title: "Map Maker Import Workflow",
    description:
      "Create a draft cemetery map project, upload raw GPR CSV, review the unnamed base map, then merge Burial.csv without silent overwrites.",
    href: "/map-maker",
    icon: GitMerge,
    status: "Primary",
  },
  {
    title: "Headstone AI Import",
    description:
      "Bulk upload headstone photos, extract names and dates with Claude, review missing text manually, then save a cemetery image library for Map Maker matching.",
    href: "/import-data/headstones",
    icon: ScanText,
    status: "Ready",
  },
  {
    title: "Headstone Library",
    description:
      "Browse all headstone images uploaded for a cemetery. See which images are linked to burial spots and view the AI-extracted inscription text and names.",
    href: "/import-data/headstone-library",
    icon: BookImage,
    status: "Library",
  },
];

export default function ImportDataPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Upload className="h-4 w-4" />
            Import Data
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Import Center
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Bring cemetery records into MemorialSpace with guided review before
            anything is written to live burial spots and map data.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {importOptions.map((option) => (
          <Card key={option.href} className="flex flex-col">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <option.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline">{option.status}</Badge>
              </div>
              <div>
                <CardTitle className="text-lg">{option.title}</CardTitle>
                <CardDescription className="mt-2">
                  {option.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full gap-2">
                <Link href={option.href}>
                  Open import
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Supported source data
          </CardTitle>
          <CardDescription>
            GPR and Burial.csv matching now live inside Map Maker so the map
            project owns every review and publish decision. Headstone import
            remains image-first and reusable by filename.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Spreadsheet rows</p>
            <p className="mt-1 text-xs text-muted-foreground">
              XLSX, XLS, or CSV files can be matched by image filename after
              headstone images are verified.
            </p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Headstone images</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Batch photos are stored in the cemetery headstone folder with
              original filenames preserved.
            </p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Map placement</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Spot number, latitude, longitude, and lot fields can be imported
              later and matched to verified image names.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
