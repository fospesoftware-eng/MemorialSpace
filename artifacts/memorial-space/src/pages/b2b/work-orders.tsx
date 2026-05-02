import { useState } from "react";
import { useListWorkOrders } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Wrench } from "lucide-react";
import { format } from "date-fns";

const ORG_ID = 1;

export default function WorkOrders() {
  const [search, setSearch] = useState("");
  const { data: workOrders, isLoading } = useListWorkOrders({ organizationId: ORG_ID });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/20 text-destructive';
      case 'high': return 'bg-[#d4a843]/20 text-[#d4a843]';
      case 'medium': return 'bg-primary/20 text-primary';
      case 'low': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-[#40916c]/20 text-[#40916c]';
      case 'in_progress': return 'bg-primary/20 text-primary';
      case 'open': return 'bg-secondary text-secondary-foreground';
      case 'cancelled': return 'bg-destructive/20 text-destructive';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const filteredWorkOrders = workOrders?.filter(wo => 
    wo.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground mt-1">Manage cemetery maintenance and operational tasks.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Order
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search work orders..." 
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
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading work orders...</TableCell>
              </TableRow>
            ) : filteredWorkOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Wrench className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No work orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-medium">{wo.title}</TableCell>
                  <TableCell className="capitalize">{wo.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize border-none ${getStatusColor(wo.status)}`}>
                      {wo.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize border-none ${getPriorityColor(wo.priority)}`}>
                      {wo.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{wo.dueDate ? format(new Date(wo.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{wo.assignedTo || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}