package com.rentals;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.*;

public class Repos {
    public interface UserRepo extends MongoRepository<Models.User, String> { Optional<Models.User> findByEmail(String e); }
    public interface PropertyRepo extends MongoRepository<Models.Property, String> { List<Models.Property> findByOwnerIdOrderByCreatedAtDesc(String o); }
    public interface BookingRepo extends MongoRepository<Models.Booking, String> {
        List<Models.Booking> findByTenantIdOrderByCreatedAtDesc(String t);
        List<Models.Booking> findByOwnerIdOrderByCreatedAtDesc(String o);
        List<Models.Booking> findByPropertyIdAndStatus(String p, String s);
    }
}
