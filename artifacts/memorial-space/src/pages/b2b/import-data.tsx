import { Link } from "wouter";
import { ArrowRight, FileSpreadsheet, ScanText, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const importOptions = [
  {
    title: "Headstone AI Import",
    description: "Upload headstone photos with a spreadsheet, extract names and dates with Claude, review the results, then write plots and burials to the cemetery map.",
    href: "/import-data/headstones",
    icon: ScanText,
    status: "Ready",
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Import Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Bring cemetery records into MemorialSpace with guided review before anything is written to live plots, burials, and map data.
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
                <CardDescription className="mt-2">{option.description}</CardDescription>
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
            Current imports support spreadsheet-driven cemetery records with image filenames, spot or plot numbers, latitude, and longitude.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Spreadsheet rows</p>
            <p className="mt-1 text-xs text-muted-foreground">XLSX, XLS, or CSV files with flexible column names.</p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Headstone images</p>
            <p className="mt-1 text-xs text-muted-foreground">Batch photos matched by filename from the spreadsheet.</p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="text-sm font-medium">Map placement</p>
            <p className="mt-1 text-xs text-muted-foreground">Plot number, latitude, and longitude are saved to cemetery plot records.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
