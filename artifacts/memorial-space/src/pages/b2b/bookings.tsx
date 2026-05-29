import { useState } from "react";
import { useListBookings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar } from "lucide-react";
import { format } from "date-fns";

const ORG_ID = 1;

export default function Bookings() {
  const [search, setSearch] = useState("");
  const { data: bookings, isLoading } = useListBookings({
    organizationId: ORG_ID,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-[#40916c]/20 text-[#40916c]";
      case "pending":
        return "bg-[#d4a843]/20 text-[#d4a843]";
      case "completed":
        return "bg-primary/20 text-primary";
      case "cancelled":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const filteredBookings =
    bookings?.filter(
      (b) =>
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        b.invoiceNumber?.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground mt-1">
            Manage burial spot sales and reservations.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or invoice..."
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
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Burial Spot ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading bookings...
                </TableCell>
              </TableRow>
            ) : filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  <Calendar className="mx-auto h-6 w-6 mb-2 opacity-50" />
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    {booking.customerName}
                    <div className="text-xs text-muted-foreground font-normal">
                      {booking.customerEmail}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{booking.type}</TableCell>
                  <TableCell>{booking.plotId}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize border-none ${getStatusColor(booking.status)}`}
                    >
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {booking.bookingDate
                      ? format(new Date(booking.bookingDate), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {booking.totalAmount
                      ? `$${booking.totalAmount.toLocaleString()}`
                      : "-"}
                  </TableCell>
                  <TableCell>{booking.invoiceNumber || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
