package com.rentals;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*;
import java.util.*;

public class Models {
    @Document("users")
    public static class User {
        @Id public String id;
        public String name; @Indexed(unique = true) public String email; public String phone;
        public String password; // BCrypt hash
    }
    @Document("properties")
    public static class Property {
        @Id public String id;
        public String ownerId, ownerName, title, type, city, area, description;
        public double rent; public int bedrooms, bathrooms, sqft;
        public List<String> amenities = new ArrayList<>(), images = new ArrayList<>();
        public Instant createdAt = Instant.now();
    }
    @Document("bookings")
    public static class Booking {
        @Id public String id;
        public String propertyId, propertyTitle, ownerId, tenantId, tenantName;
        public LocalDate startDate, endDate; public int months; public double monthlyRent, totalRent;
        public String status = "PENDING"; // PENDING | APPROVED | REJECTED
        public Instant createdAt = Instant.now();
    }
}
