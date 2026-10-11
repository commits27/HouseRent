package com.rentals;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

@RestController @RequestMapping("/api/auth")
class AuthController {
    private final Repos.UserRepo users; private final Jwt jwt; private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    AuthController(Repos.UserRepo u, Jwt j) { users = u; jwt = j; }

    record RegisterReq(String name, String email, String phone, String password) {}
    record LoginReq(String email, String password) {}

    @PostMapping("/register") Map<String, Object> register(@RequestBody RegisterReq r) {
        if (r == null || blank(r.name()) || blank(r.email()) || blank(r.password()) || r.password().length() < 6)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name, email and a password (min 6 chars) are required");
        String email = r.email().trim().toLowerCase();
        if (!EMAIL.matcher(email).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address");
        if (users.findByEmail(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        Models.User u = new Models.User();
        u.name = r.name().trim(); u.email = email; u.phone = r.phone(); u.password = enc.encode(r.password());
        try { users.save(u); } catch (DuplicateKeyException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered"); }
        return session(u);
    }
    @PostMapping("/login") Map<String, Object> login(@RequestBody LoginReq r) {
        String email = r == null || r.email() == null ? "" : r.email().trim().toLowerCase();
        String password = r == null ? null : r.password();
        Models.User u = users.findByEmail(email).orElse(null);
        if (u == null || password == null || u.password == null || !enc.matches(password, u.password))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        return session(u);
    }
    private Map<String, Object> session(Models.User u) {
        return Map.of("token", jwt.make(u.id), "user", Map.of("id", u.id, "name", u.name, "email", u.email));
    }
    static boolean blank(String s) { return s == null || s.isBlank(); }
}

@RestController @RequestMapping("/api/properties")
class PropertyController {
    private final Repos.PropertyRepo repo; private final Repos.UserRepo users; private final MongoTemplate mongo;
    PropertyController(Repos.PropertyRepo r, Repos.UserRepo u, MongoTemplate m) { repo = r; users = u; mongo = m; }

    @GetMapping List<Models.Property> list(@RequestParam(required = false) String area, @RequestParam(required = false) String type,
                                           @RequestParam(required = false) Double min, @RequestParam(required = false) Double max,
                                           @RequestParam(required = false) Integer bedrooms) {
        List<Criteria> c = new ArrayList<>();
        if (!AuthController.blank(area)) {
            Pattern p = Pattern.compile(Pattern.quote(area.trim()), Pattern.CASE_INSENSITIVE);
            c.add(new Criteria().orOperator(Criteria.where("area").regex(p), Criteria.where("city").regex(p)));
        }
        if (!AuthController.blank(type) && !type.equals("All")) c.add(Criteria.where("type").is(type));
        if (min != null || max != null) {
            Criteria r = Criteria.where("rent");
            if (min != null) r = r.gte(min);
            if (max != null) r = r.lte(max);
            c.add(r);
        }
        if (bedrooms != null && bedrooms > 0) c.add(Criteria.where("bedrooms").gte(bedrooms));
        Query q = new Query().with(org.springframework.data.domain.Sort.by("createdAt").descending());
        if (!c.isEmpty()) q.addCriteria(new Criteria().andOperator(c));
        return mongo.find(q, Models.Property.class);
    }
    @GetMapping("/mine") List<Models.Property> mine(@RequestAttribute("uid") String uid) { return repo.findByOwnerIdOrderByCreatedAtDesc(uid); }
    @GetMapping("/{id}") Models.Property get(@PathVariable String id) {
        return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));
    }
    @PostMapping Models.Property create(@RequestAttribute("uid") String uid, @RequestBody Models.Property p) {
        if (AuthController.blank(p.title) || AuthController.blank(p.type) || AuthController.blank(p.area) || p.rent <= 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title, type, area and a rent > 0 are required");
        p.id = null; p.ownerId = uid; p.ownerName = users.findById(uid).map(u -> u.name).orElse("Owner"); p.createdAt = java.time.Instant.now();
        return repo.save(p);
    }
    @DeleteMapping("/{id}") void delete(@RequestAttribute("uid") String uid, @PathVariable String id) {
        Models.Property p = get(id);
        if (!p.ownerId.equals(uid)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your property");
        repo.delete(p);
    }
}

@RestController @RequestMapping("/api/bookings")
class BookingController {
    private final Repos.BookingRepo bookings; private final Repos.PropertyRepo props; private final Repos.UserRepo users;
    BookingController(Repos.BookingRepo b, Repos.PropertyRepo p, Repos.UserRepo u) { bookings = b; props = p; users = u; }

    record BookReq(String propertyId, String startDate, int months) {}

    @PostMapping Models.Booking book(@RequestAttribute("uid") String uid, @RequestBody BookReq r) {
        if (r == null || AuthController.blank(r.propertyId()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A property is required");
        Models.Property p = props.findById(r.propertyId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));
        if (Objects.equals(p.ownerId, uid)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't book your own property");
        if (r.months() < 1 || r.months() > 36) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose 1 to 36 months");
        LocalDate start;
        try { start = LocalDate.parse(r.startDate()); } catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick a valid start date"); }
        if (start.isBefore(LocalDate.now())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date can't be in the past");
        Models.Booking b = new Models.Booking();
        b.propertyId = p.id; b.propertyTitle = p.title; b.ownerId = p.ownerId; b.tenantId = uid;
        b.tenantName = users.findById(uid).map(u -> u.name).orElse("Tenant");
        b.startDate = start; b.months = r.months(); b.endDate = start.plusMonths(r.months());
        b.monthlyRent = p.rent; b.totalRent = p.rent * r.months();
        checkFree(b);
        return bookings.save(b);
    }
    @GetMapping("/mine") List<Models.Booking> mine(@RequestAttribute("uid") String uid) { return bookings.findByTenantIdOrderByCreatedAtDesc(uid); }
    @GetMapping("/requests") List<Models.Booking> requests(@RequestAttribute("uid") String uid) { return bookings.findByOwnerIdOrderByCreatedAtDesc(uid); }

    @PutMapping("/{id}/status") Models.Booking decide(@RequestAttribute("uid") String uid, @PathVariable String id, @RequestParam String value) {
        Models.Booking b = bookings.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (!Objects.equals(b.ownerId, uid)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your property");
        if (!b.status.equals("PENDING")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already " + b.status.toLowerCase());
        if (!value.equals("APPROVED") && !value.equals("REJECTED")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        if (value.equals("APPROVED")) checkFree(b);
        b.status = value; return bookings.save(b);
    }
    private void checkFree(Models.Booking n) {
        for (Models.Booking o : bookings.findByPropertyIdAndStatus(n.propertyId, "APPROVED"))
            if (n.startDate.isBefore(o.endDate) && o.startDate.isBefore(n.endDate))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Property is already booked from " + o.startDate + " to " + o.endDate);
    }
}
