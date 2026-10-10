package com.rentals;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.*;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;
import javax.crypto.SecretKey;
import java.util.*;

@SpringBootApplication
@EnableMongoRepositories(considerNestedRepositories = true)
public class App {
    public static void main(String[] a) { SpringApplication.run(App.class, a); }

    /** Seeds a few sample listings the first time so the dashboard isn't empty. */
    @Bean CommandLineRunner seed(Repos.PropertyRepo repo) {
        return x -> {
            if (repo.count() > 0) return;
            repo.saveAll(List.of(
                p("Sunset Luxury Villa", "Villa", "Hyderabad", "Jubilee Hills", 85000, 4, 4, 3200, "Spacious villa with a private garden and pool.", "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900"),
                p("Modern 2BHK Apartment", "Apartment", "Hyderabad", "Gachibowli", 28000, 2, 2, 1150, "Bright apartment near the IT corridor.", "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900"),
                p("Cozy 1BHK Flat", "Flat", "Hyderabad", "Madhapur", 16000, 1, 1, 650, "Compact, well-ventilated flat for singles or couples.", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900", "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900"),
                p("Independent House with Terrace", "Independent House", "Hyderabad", "Kondapur", 35000, 3, 3, 1800, "Ground+1 house with parking and terrace.", "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900", "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900")));
        };
    }

    static Models.Property p(String t, String type, String city, String area, double rent, int bd, int ba, int sq, String d, String... img) {
        Models.Property p = new Models.Property();
        p.ownerId = "seed"; p.ownerName = "Demo Owner"; p.title = t; p.type = type; p.city = city; p.area = area;
        p.rent = rent; p.bedrooms = bd; p.bathrooms = ba; p.sqft = sq; p.description = d;
        p.amenities = List.of("Parking", "Power Backup", "24x7 Water", "Security", "Lift", "Wi-Fi");
        p.images = List.of(img);
        return p;
    }
}

@Component
class Jwt {
    private final SecretKey key;
    Jwt(@Value("${jwt.secret}") String s) { key = Keys.hmacShaKeyFor(s.getBytes()); }
    String make(String uid) { return Jwts.builder().subject(uid).expiration(new Date(System.currentTimeMillis() + 86_400_000L)).signWith(key).compact(); }
    String parse(String t) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(t).getPayload().getSubject(); }
}

@Configuration
class WebCfg implements WebMvcConfigurer {
    private final Jwt jwt;
    WebCfg(Jwt jwt) { this.jwt = jwt; }

    @Override public void addInterceptors(InterceptorRegistry r) {
        r.addInterceptor(new HandlerInterceptor() {
            public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object h) throws Exception {
                if ("OPTIONS".equals(req.getMethod())) return true;
                String a = req.getHeader("Authorization");
                try { req.setAttribute("uid", jwt.parse(a.substring(7))); return true; }
                catch (Exception e) { res.sendError(401, "Please log in again"); return false; }
            }
        }).addPathPatterns("/api/**").excludePathPatterns("/api/auth/**");
    }

    @Override public void addCorsMappings(CorsRegistry r) {
        r.addMapping("/api/**").allowedOrigins("http://localhost:5173").allowedMethods("*").allowedHeaders("*");
    }
}