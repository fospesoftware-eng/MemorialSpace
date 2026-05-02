import { useState } from "react";
import { useListBurials } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users } from "lucide-react";
import { format } from "date-fns";

const ORG_ID = 1;

export default function Burials() {
  const [search, setSearch] = useState("");
  const { data: burials, isLoading } = useListBurials({ organizationId: ORG_ID });

  const filteredBurials = burials?.filter(b => 
    b.deceasedName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Burials</h1>
          <p className="text-muted-foreground mt-1">Manage burial records and deceased information.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Burial
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search deceased name..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deceased Name</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Date of Death</TableHead>
              <TableHead>Burial Date</TableHead>
              <TableHead>Religion</TableHead>
              <TableHead>Plot ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading burials...</TableCell>
              </TableRow>
            ) : filteredBurials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Users className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No burials found
                </TableCell>
              </TableRow>
            ) : (
              filteredBurials.map((burial) => (
                <TableRow key={burial.id}>
                  <TableCell className="font-medium">{burial.deceasedName}</TableCell>
                  <TableCell>{burial.deceasedDob ? format(new Date(burial.deceasedDob), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.deceasedDod ? format(new Date(burial.deceasedDod), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.deceasedDob ? format(new Date(burial.burialDate!), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{burial.religion || '-'}</TableCell>
                  <TableCell>{burial.plotId}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}