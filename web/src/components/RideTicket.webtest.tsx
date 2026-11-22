import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RideTicket } from "./RideTicket";

describe("RideTicket", () => {
  it("labels mock data and exposes the ride link", () => {
    render(<MemoryRouter><RideTicket item={{
      source: "demo",
      ride: { id: "demo-1", driverId: "driver", status: "SCHEDULED", route: { type: "LineString", coordinates: [[77.59, 12.97], [77.61, 12.98]] }, origin: [77.59, 12.97], destination: [77.61, 12.98], routeLengthM: 2200, departureTime: "2026-11-21T03:30:00.000Z", seatsTotal: 4, seatsAvailable: 2, pricePerSeatPaise: 12000, currency: "INR", priceDisplay: "₹120.00" },
      walkPickupM: 240, walkDropoffM: 320, pickupOffsetM: 500, dropoffOffsetM: 1900, tripDistanceM: 1400, priceDisplay: "₹120.00",
    }} /></MemoryRouter>);
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View ride" })).toHaveAttribute("href", "/app/rides/demo-1");
    expect(screen.getByText("240 m walk")).toBeInTheDocument();
  });
});
