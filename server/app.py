"""House Hunt Flask API.

Backend service for HOUSE HUNT — Find Your Place, Feel at Home.
Uses Flask, Flask-SQLAlchemy, Flask-CORS, PyMySQL, bcrypt, and PyJWT.
"""
from datetime import date, datetime, timedelta, timezone
from functools import wraps
import os
from pathlib import Path
import re
import sys

# Ensure server directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import bcrypt
import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, UniqueConstraint
from sqlalchemy.exc import IntegrityError

# Load environment variables: check server directory first, then root cwd
env_file = Path(__file__).resolve().parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
load_dotenv()

app = Flask(__name__)

# Database configuration
database_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
if database_url:
    # Convert cloud prefixes for SQLAlchemy compatibility
    if database_url.startswith("mysql://"):
        database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
else:
    mysql_user = os.getenv("MYSQL_USER")
    mysql_password = os.getenv("MYSQL_PASSWORD")
    mysql_host = os.getenv("MYSQL_HOST", "127.0.0.1")
    mysql_port = os.getenv("MYSQL_PORT", "3306")
    mysql_database = os.getenv("MYSQL_DATABASE")
    if not mysql_user or not mysql_password or not mysql_database:
        raise RuntimeError("DATABASE_URL or MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE must be configured")
    database_url = f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}"

jwt_secret = os.getenv("JWT_SECRET")
if not jwt_secret:
    if os.getenv("FLASK_ENV") == "production":
        raise RuntimeError("JWT_SECRET must be configured in production")
    jwt_secret = "househunt-dev-jwt-secret-replace-with-32chars-in-production"

app.config.update(
    SQLALCHEMY_DATABASE_URI=database_url,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SQLALCHEMY_ENGINE_OPTIONS={
        "pool_recycle": 280,
        "pool_pre_ping": True,
    },
    JWT_SECRET=jwt_secret,
)

db = SQLAlchemy(app)

# CORS configuration: allow Vercel production domains, previews, and localhost
frontend_origin_env = os.getenv("FRONTEND_ORIGIN", "*").strip()
if not frontend_origin_env or frontend_origin_env == "*":
    origins = "*"
else:
    origins = [x.strip() for x in frontend_origin_env.split(",") if x.strip()]

CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False)


# ==============================================================================
# Database Models
# ==============================================================================

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(40))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    status = db.Column(db.String(20), nullable=False, default="active")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    properties = db.relationship("Property", back_populates="owner", cascade="all, delete-orphan")


class Property(db.Model):
    __tablename__ = "properties"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, default="")
    property_type = db.Column(db.String(60), nullable=False, default="Apartment")
    listing_type = db.Column(db.String(20), nullable=False, default="Rent")
    price = db.Column(db.Float, nullable=False, default=0)
    location = db.Column(db.String(160), nullable=False, default="")
    city = db.Column(db.String(100), nullable=False, default="")
    bedrooms = db.Column(db.Integer, nullable=False, default=0)
    bathrooms = db.Column(db.Integer, nullable=False, default=0)
    area_sqft = db.Column(db.Integer, nullable=False, default=0)
    furnishing = db.Column(db.String(40), default="Unfurnished")
    amenities = db.Column(db.JSON, default=list)
    images = db.Column(db.JSON, default=list)
    listing_status = db.Column(db.String(30), nullable=False, default="Available")
    featured = db.Column(db.Boolean, nullable=False, default=False)
    verified = db.Column(db.Boolean, nullable=False, default=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    owner = db.relationship("User", back_populates="properties")


class Favorite(db.Model):
    __tablename__ = "favorites"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "property_id", name="uq_favorite_user_property"),)
    property = db.relationship("Property")


class Inquiry(db.Model):
    __tablename__ = "inquiries"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(40))
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    property = db.relationship("Property")


class Booking(db.Model):
    __tablename__ = "bookings"
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"), nullable=False)
    property_title = db.Column(db.String(180), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    tenant_name = db.Column(db.String(120), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    months = db.Column(db.Integer, nullable=False)
    monthly_rent = db.Column(db.Float, nullable=False)
    total_rent = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="PENDING")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


# ==============================================================================
# Helper functions & Error Handlers
# ==============================================================================

def error(message, status=400):
    return jsonify({"message": message, "error": message}), status


@app.errorhandler(404)
def not_found(_):
    return error("Resource not found", 404)


@app.errorhandler(500)
def server_error(exc):
    app.logger.exception("Unhandled server error", exc_info=exc)
    return error("Internal server error", 500)


def token_for(user):
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(days=2)
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def user_json(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone or "",
        "role": user.role,
        "status": user.status,
        "createdAt": user.created_at.isoformat() if user.created_at else None
    }


def auth_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return error("Please log in again", 401)
        try:
            payload = jwt.decode(header[7:], app.config["JWT_SECRET"], algorithms=["HS256"])
            user = db.session.get(User, int(payload["sub"]))
            if not user or user.status != "active":
                raise ValueError("inactive user")
        except Exception:
            return error("Please log in again", 401)
        g.user = user
        return fn(*args, **kwargs)
    return wrapped


def admin_required(fn):
    @wraps(fn)
    @auth_required
    def wrapped(*args, **kwargs):
        if g.user.role != "admin":
            return error("Administrator access required", 403)
        return fn(*args, **kwargs)
    return wrapped


def property_json(p):
    if not p:
        return None
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description or "",
        "type": p.property_type,
        "propertyType": p.property_type,
        "listingType": p.listing_type,
        "rent": p.price,
        "price": p.price,
        "area": p.location,
        "location": p.location,
        "city": p.city,
        "bedrooms": p.bedrooms,
        "bathrooms": p.bathrooms,
        "sqft": p.area_sqft,
        "areaSqft": p.area_sqft,
        "furnishing": p.furnishing or "Unfurnished",
        "amenities": p.amenities or [],
        "images": p.images or [],
        "status": p.listing_status,
        "listingStatus": p.listing_status,
        "featured": bool(p.featured),
        "verified": bool(p.verified),
        "ownerId": p.owner_id,
        "ownerName": p.owner.name if p.owner else "Owner",
        "createdAt": p.created_at.isoformat() if p.created_at else None,
    }


def booking_json(b):
    return {
        "id": b.id,
        "propertyId": b.property_id,
        "propertyTitle": b.property_title,
        "ownerId": b.owner_id,
        "tenantId": b.tenant_id,
        "tenantName": b.tenant_name,
        "startDate": b.start_date.isoformat(),
        "endDate": b.end_date.isoformat(),
        "months": b.months,
        "monthlyRent": b.monthly_rent,
        "totalRent": b.total_rent,
        "status": b.status,
        "createdAt": b.created_at.isoformat() if b.created_at else None,
    }


def inquiry_json(i):
    return {
        "id": i.id,
        "propertyId": i.property_id,
        "propertyTitle": i.property.title if i.property else "General Inquiry",
        "name": i.name,
        "email": i.email,
        "phone": i.phone or "",
        "message": i.message,
        "status": i.status,
        "createdAt": i.created_at.isoformat() if i.created_at else None,
    }


# ==============================================================================
# Health Check Endpoint
# ==============================================================================

@app.get("/api/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    return jsonify({
        "status": "ok",
        "service": "House Hunt API",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# ==============================================================================
# Authentication Endpoints
# ==============================================================================

@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password")

    if not name or not email or not password or len(password) < 6:
        return error("Name, email and a password (min 6 characters) are required")
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return error("Enter a valid email address")

    if User.query.filter_by(email=email).first():
        return error("Email already registered", 409)

    # Note: role is strictly forced to "user" to prevent privilege escalation
    user = User(
        name=name,
        email=email,
        phone=str(data.get("phone", "")).strip() or None,
        password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        role="user",
        status="active"
    )
    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("Email already registered", 409)

    return jsonify({"token": token_for(user), "user": user_json(user)}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return error("Email and password are required", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return error("Invalid email or password", 401)

    if user.status != "active":
        return error("Account has been suspended. Please contact support.", 403)

    return jsonify({"token": token_for(user), "user": user_json(user)})


@app.get("/api/auth/me")
@auth_required
def me():
    return jsonify(user_json(g.user))


@app.put("/api/auth/me")
@auth_required
def update_me():
    data = request.get_json(silent=True) or {}
    if data.get("name"):
        g.user.name = str(data["name"]).strip()
    if "phone" in data:
        g.user.phone = str(data["phone"]).strip() or None
    db.session.commit()
    return jsonify(user_json(g.user))


@app.put("/api/auth/password")
@auth_required
def change_password():
    data = request.get_json(silent=True) or {}
    curr_pw = data.get("currentPassword", "")
    new_pw = data.get("newPassword", "")

    if not curr_pw or not bcrypt.checkpw(str(curr_pw).encode(), g.user.password_hash.encode()):
        return error("Current password is incorrect", 400)
    if not new_pw or len(new_pw) < 6:
        return error("New password must be at least 6 characters")

    g.user.password_hash = bcrypt.hashpw(str(new_pw).encode(), bcrypt.gensalt()).decode()
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})


# ==============================================================================
# Property Endpoints
# ==============================================================================

def property_query():
    q = Property.query.filter(Property.listing_status != "Deleted")
    area = request.args.get("area")
    ptype = request.args.get("type")
    listing = request.args.get("listingType")

    if area:
        area_term = f"%{area.strip()}%"
        q = q.filter(or_(
            Property.location.ilike(area_term),
            Property.city.ilike(area_term),
            Property.title.ilike(area_term),
            Property.description.ilike(area_term)
        ))
    if ptype and ptype not in ("All", "All types", "Any"):
        q = q.filter(Property.property_type == ptype)
    if listing and listing not in ("All", "Any"):
        q = q.filter(Property.listing_type == listing)
    if request.args.get("min"):
        try:
            q = q.filter(Property.price >= float(request.args["min"]))
        except ValueError:
            pass
    if request.args.get("max"):
        try:
            q = q.filter(Property.price <= float(request.args["max"]))
        except ValueError:
            pass
    if request.args.get("bedrooms") and request.args["bedrooms"] not in ("Any", "All"):
        try:
            q = q.filter(Property.bedrooms >= int(request.args["bedrooms"]))
        except ValueError:
            pass
    if request.args.get("bathrooms") and request.args["bathrooms"] not in ("Any", "All"):
        try:
            q = q.filter(Property.bathrooms >= int(request.args["bathrooms"]))
        except ValueError:
            pass

    sort = request.args.get("sort", "newest")
    if sort == "price_asc":
        return q.order_by(Property.price.asc())
    elif sort == "price_desc":
        return q.order_by(Property.price.desc())
    elif sort == "sqft_desc":
        return q.order_by(Property.area_sqft.desc())
    return q.order_by(Property.created_at.desc())


@app.get("/api/properties")
def properties():
    props = property_query().all()
    return jsonify([property_json(p) for p in props])


@app.get("/api/properties/<int:property_id>")
def property_detail(property_id):
    p = db.session.get(Property, property_id)
    if not p or p.listing_status == "Deleted":
        return error("Property not found", 404)
    return jsonify(property_json(p))


@app.get("/api/properties/mine")
@auth_required
def my_properties():
    props = Property.query.filter_by(owner_id=g.user.id).filter(Property.listing_status != "Deleted").order_by(Property.created_at.desc()).all()
    return jsonify([property_json(p) for p in props])


@app.post("/api/properties")
@auth_required
def create_property():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    location = str(data.get("area", data.get("location", ""))).strip()
    price = data.get("rent", data.get("price", 0))

    if not title or not location or float(price or 0) <= 0:
        return error("Title, area/location and a price greater than 0 are required")

    p = Property(
        title=title,
        description=data.get("description", ""),
        property_type=data.get("type", data.get("propertyType", "Apartment")),
        listing_type=data.get("listingType", "Rent"),
        price=float(price),
        location=location,
        city=data.get("city", "Hyderabad"),
        bedrooms=int(data.get("bedrooms", 0) or 0),
        bathrooms=int(data.get("bathrooms", 0) or 0),
        area_sqft=int(data.get("sqft", data.get("areaSqft", 0)) or 0),
        furnishing=data.get("furnishing", "Unfurnished"),
        amenities=data.get("amenities", []) if isinstance(data.get("amenities"), list) else [x.strip() for x in str(data.get("amenities", "")).split(",") if x.strip()],
        images=data.get("images", []) if isinstance(data.get("images"), list) else [x.strip() for x in str(data.get("images", "")).split(",") if x.strip()],
        owner_id=g.user.id,
        listing_status="Available",
        verified=False,
        featured=False
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(property_json(p)), 201


@app.put("/api/properties/<int:property_id>")
@auth_required
def update_property(property_id):
    p = db.session.get(Property, property_id)
    if not p or p.listing_status == "Deleted":
        return error("Property not found", 404)
    if p.owner_id != g.user.id and g.user.role != "admin":
        return error("Not your property", 403)

    data = request.get_json(silent=True) or {}
    fields_map = {
        "title": "title",
        "description": "description",
        "city": "city",
        "area": "location",
        "location": "location",
        "furnishing": "furnishing",
        "type": "property_type",
        "propertyType": "property_type",
        "listingType": "listing_type",
        "status": "listing_status",
        "listingStatus": "listing_status"
    }
    for req_key, model_attr in fields_map.items():
        if req_key in data:
            setattr(p, model_attr, data[req_key])

    if "rent" in data or "price" in data:
        p.price = float(data.get("rent", data.get("price")))
    if "bedrooms" in data:
        p.bedrooms = int(data["bedrooms"] or 0)
    if "bathrooms" in data:
        p.bathrooms = int(data["bathrooms"] or 0)
    if "sqft" in data or "areaSqft" in data:
        p.area_sqft = int(data.get("sqft", data.get("areaSqft", 0)) or 0)
    if "amenities" in data:
        p.amenities = data["amenities"] if isinstance(data["amenities"], list) else [x.strip() for x in str(data["amenities"]).split(",") if x.strip()]
    if "images" in data:
        p.images = data["images"] if isinstance(data["images"], list) else [x.strip() for x in str(data["images"]).split(",") if x.strip()]

    db.session.commit()
    return jsonify(property_json(p))


@app.delete("/api/properties/<int:property_id>")
@auth_required
def delete_property(property_id):
    p = db.session.get(Property, property_id)
    if not p:
        return error("Property not found", 404)
    if p.owner_id != g.user.id and g.user.role != "admin":
        return error("Not your property", 403)

    p.listing_status = "Deleted"
    db.session.commit()
    return ("", 204)


# ==============================================================================
# Favorites Endpoints
# ==============================================================================

@app.get("/api/favorites")
@auth_required
def favorites():
    favs = Favorite.query.filter_by(user_id=g.user.id).order_by(Favorite.created_at.desc()).all()
    results = []
    for f in favs:
        if f.property and f.property.listing_status != "Deleted":
            results.append(property_json(f.property))
    return jsonify(results)


@app.post("/api/favorites/<int:property_id>")
@auth_required
def add_favorite(property_id):
    p = db.session.get(Property, property_id)
    if not p or p.listing_status == "Deleted":
        return error("Property not found", 404)

    existing = Favorite.query.filter_by(user_id=g.user.id, property_id=property_id).first()
    if not existing:
        db.session.add(Favorite(user_id=g.user.id, property_id=property_id))
        db.session.commit()
    return jsonify({"message": "Property saved to favorites", "propertyId": property_id}), 201


@app.delete("/api/favorites/<int:property_id>")
@auth_required
def remove_favorite(property_id):
    Favorite.query.filter_by(user_id=g.user.id, property_id=property_id).delete()
    db.session.commit()
    return ("", 204)


# ==============================================================================
# Inquiries Endpoints
# ==============================================================================

@app.post("/api/inquiries")
def create_inquiry():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    message = str(data.get("message", "")).strip()
    prop_id = data.get("propertyId")

    if not name or not email or not message:
        return error("Name, email and message are required")

    p = None
    if prop_id:
        p = db.session.get(Property, prop_id)
        if not p:
            return error("Property not found", 404)

    # Check optional token to link user_id
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            payload = jwt.decode(auth_header[7:], app.config["JWT_SECRET"], algorithms=["HS256"])
            u = db.session.get(User, int(payload["sub"]))
            if u:
                user_id = u.id
        except Exception:
            pass

    inq = Inquiry(
        user_id=user_id,
        property_id=p.id if p else None,
        name=name,
        email=email,
        phone=str(data.get("phone", "")).strip() or None,
        message=message,
        status="Pending"
    )
    db.session.add(inq)
    db.session.commit()
    return jsonify({"id": inq.id, "status": inq.status, "message": "Inquiry sent successfully"}), 201


@app.get("/api/inquiries/mine")
@auth_required
def my_inquiries():
    inqs = Inquiry.query.filter(
        or_(Inquiry.user_id == g.user.id, Inquiry.email == g.user.email)
    ).order_by(Inquiry.created_at.desc()).all()
    return jsonify([inquiry_json(i) for i in inqs])


@app.get("/api/inquiries/received")
@auth_required
def inquiries_received():
    my_props = Property.query.filter_by(owner_id=g.user.id).all()
    my_prop_ids = [p.id for p in my_props]
    if not my_prop_ids:
        return jsonify([])
    inqs = Inquiry.query.filter(Inquiry.property_id.in_(my_prop_ids)).order_by(Inquiry.created_at.desc()).all()
    return jsonify([inquiry_json(i) for i in inqs])


@app.put("/api/inquiries/<int:inquiry_id>/status")
@auth_required
def update_inquiry_status(inquiry_id):
    i = db.session.get(Inquiry, inquiry_id)
    if not i:
        return error("Inquiry not found", 404)
    if g.user.role != "admin":
        if not i.property or i.property.owner_id != g.user.id:
            return error("Unauthorized", 403)
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in ("Pending", "Contacted", "Closed"):
        return error("Invalid inquiry status")
    i.status = status
    db.session.commit()
    return jsonify(inquiry_json(i))


# ==============================================================================
# Bookings Endpoints
# ==============================================================================

@app.post("/api/bookings")
@auth_required
def create_booking():
    data = request.get_json(silent=True) or {}
    p = db.session.get(Property, data.get("propertyId"))
    if not p or p.listing_status == "Deleted":
        return error("Property not found", 404)
    if p.owner_id == g.user.id:
        return error("You cannot book your own property")

    try:
        start = date.fromisoformat(data.get("startDate", ""))
        months = int(data.get("months", 0))
    except (TypeError, ValueError):
        return error("Please select a valid start date")

    if months < 1 or months > 36:
        return error("Choose between 1 and 36 months")
    if start < date.today():
        return error("Start date cannot be in the past")

    end = start + timedelta(days=30 * months)
    overlap = Booking.query.filter_by(property_id=p.id, status="APPROVED").filter(
        Booking.start_date < end, Booking.end_date > start
    ).first()
    if overlap:
        return error(f"Property is already booked from {overlap.start_date} to {overlap.end_date}", 409)

    b = Booking(
        property_id=p.id,
        property_title=p.title,
        owner_id=p.owner_id,
        tenant_id=g.user.id,
        tenant_name=g.user.name,
        start_date=start,
        end_date=end,
        months=months,
        monthly_rent=p.price,
        total_rent=p.price * months,
        status="PENDING"
    )
    db.session.add(b)
    db.session.commit()
    return jsonify(booking_json(b)), 201


@app.get("/api/bookings/mine")
@auth_required
def bookings_mine():
    b_list = Booking.query.filter_by(tenant_id=g.user.id).order_by(Booking.created_at.desc()).all()
    return jsonify([booking_json(b) for b in b_list])


@app.get("/api/bookings/requests")
@auth_required
def booking_requests():
    b_list = Booking.query.filter_by(owner_id=g.user.id).order_by(Booking.created_at.desc()).all()
    return jsonify([booking_json(b) for b in b_list])


@app.put("/api/bookings/<int:booking_id>/status")
@auth_required
def booking_status(booking_id):
    b = db.session.get(Booking, booking_id)
    value = request.args.get("value")
    if not b:
        return error("Booking not found", 404)
    if b.owner_id != g.user.id and g.user.role != "admin":
        return error("Not your property", 403)
    if b.status != "PENDING" or value not in ("APPROVED", "REJECTED"):
        return error("Invalid booking status")

    if value == "APPROVED":
        overlap = Booking.query.filter(
            Booking.id != b.id,
            Booking.property_id == b.property_id,
            Booking.status == "APPROVED",
            Booking.start_date < b.end_date,
            Booking.end_date > b.start_date
        ).first()
        if overlap:
            return error("Property is already booked for these dates", 409)

    b.status = value
    db.session.commit()
    return jsonify(booking_json(b))


# ==============================================================================
# Admin Endpoints
# ==============================================================================

@app.get("/api/admin/stats")
@admin_required
def admin_stats():
    return jsonify({
        "totalProperties": Property.query.filter(Property.listing_status != "Deleted").count(),
        "totalUsers": User.query.count(),
        "totalInquiries": Inquiry.query.count(),
        "pendingInquiries": Inquiry.query.filter_by(status="Pending").count(),
        "totalBookings": Booking.query.count(),
        "pendingBookings": Booking.query.filter_by(status="PENDING").count()
    })


@app.get("/api/admin/users")
@admin_required
def admin_users():
    users_list = User.query.order_by(User.created_at.desc()).all()
    return jsonify([user_json(u) for u in users_list])


@app.put("/api/admin/users/<int:user_id>/status")
@admin_required
def admin_update_user_status(user_id):
    target = db.session.get(User, user_id)
    if not target:
        return error("User not found", 404)
    if target.id == g.user.id:
        return error("You cannot suspend your own admin account", 400)

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ("active", "suspended"):
        return error("Status must be 'active' or 'suspended'")

    target.status = new_status
    db.session.commit()
    return jsonify(user_json(target))


@app.get("/api/admin/inquiries")
@admin_required
def admin_inquiries():
    inqs = Inquiry.query.order_by(Inquiry.created_at.desc()).all()
    return jsonify([inquiry_json(i) for i in inqs])


@app.put("/api/admin/inquiries/<int:inquiry_id>")
@admin_required
def admin_update_inquiry(inquiry_id):
    i = db.session.get(Inquiry, inquiry_id)
    if not i:
        return error("Inquiry not found", 404)
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in ("Pending", "Contacted", "Closed"):
        return error("Invalid inquiry status")
    i.status = status
    db.session.commit()
    return jsonify(inquiry_json(i))


@app.get("/api/admin/properties")
@admin_required
def admin_properties():
    props = Property.query.order_by(Property.created_at.desc()).all()
    return jsonify([property_json(p) for p in props])


@app.put("/api/admin/properties/<int:property_id>/featured")
@admin_required
def admin_toggle_featured(property_id):
    p = db.session.get(Property, property_id)
    if not p:
        return error("Property not found", 404)
    p.featured = not p.featured
    db.session.commit()
    return jsonify(property_json(p))


# ==============================================================================
# Database Initialization & Seeding
# ==============================================================================

SAMPLE_PROPERTIES = [
    {
        "title": "Serene Greens Luxury Villa",
        "description": "Exquisite 4-BHK private villa featuring landscaped gardens, infinity pool, modern Italian modular kitchen, and smart home automation in prime Jubilee Hills.",
        "property_type": "Villa",
        "listing_type": "Rent",
        "price": 85000,
        "location": "Jubilee Hills",
        "city": "Hyderabad",
        "bedrooms": 4,
        "bathrooms": 4,
        "area_sqft": 3600,
        "furnishing": "Fully Furnished",
        "amenities": ["Private Pool", "Landscaped Garden", "Covered Parking", "24/7 Security", "Clubhouse", "Power Backup"],
        "images": [
            "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200",
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200",
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200"
        ],
        "featured": True,
        "verified": True,
    },
    {
        "title": "Skyline Heights Horizon 3BHK",
        "description": "High-rise luxury 3BHK apartment overlooking Durgam Cheruvu lake. Fully air-conditioned with floor-to-ceiling panoramic glass windows and top-tier amenities.",
        "property_type": "Apartment",
        "listing_type": "Rent",
        "price": 45000,
        "location": "Hitec City",
        "city": "Hyderabad",
        "bedrooms": 3,
        "bathrooms": 3,
        "area_sqft": 1950,
        "furnishing": "Semi-Furnished",
        "amenities": ["Infinity Pool", "Fitness Center", "Lift", "Covered Parking", "EV Charging", "Children Play Area"],
        "images": [
            "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200"
        ],
        "featured": True,
        "verified": True,
    },
    {
        "title": "Urban Oasis Studio Apartment",
        "description": "Chic, minimalist designer studio with smart work-from-home desk setup, high-speed fiber connectivity, and cozy private balcony near tech hubs.",
        "property_type": "Studio",
        "listing_type": "Rent",
        "price": 22000,
        "location": "Koramangala",
        "city": "Bangalore",
        "bedrooms": 1,
        "bathrooms": 1,
        "area_sqft": 650,
        "furnishing": "Fully Furnished",
        "amenities": ["High-Speed Wi-Fi", "Lift", "Gym", "Power Backup", "Security Access Card"],
        "images": [
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200"
        ],
        "featured": False,
        "verified": True,
    },
    {
        "title": "Palm Grove Independent House",
        "description": "Spacious independent duplex house with private terrace, rooftop garden, dedicated covered car park, and quiet residential surroundings.",
        "property_type": "Independent House",
        "listing_type": "Buy",
        "price": 14500000,
        "location": "Gachibowli",
        "city": "Hyderabad",
        "bedrooms": 4,
        "bathrooms": 3,
        "area_sqft": 2800,
        "furnishing": "Semi-Furnished",
        "amenities": ["Private Terrace", "Rooftop Garden", "Reserved Parking", "CCTV Surveillance", "Solar Water Heating"],
        "images": [
            "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200",
            "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200"
        ],
        "featured": True,
        "verified": True,
    },
    {
        "title": "The Grandview Modern Flat",
        "description": "Tastefully designed 2BHK flat with open modular layout, premium teak wood wardrobes, and excellent cross-ventilation in peaceful neighborhood.",
        "property_type": "Flat",
        "listing_type": "Rent",
        "price": 32000,
        "location": "Indiranagar",
        "city": "Bangalore",
        "bedrooms": 2,
        "bathrooms": 2,
        "area_sqft": 1250,
        "furnishing": "Fully Furnished",
        "amenities": ["Swimming Pool", "24/7 Security", "Jogging Track", "Intercom", "Power Backup"],
        "images": [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200",
            "https://images.unsplash.com/photo-1502005229762-ee1b2b8ab00f?w=1200"
        ],
        "featured": False,
        "verified": True,
    },
    {
        "title": "Bayside Horizon Sea-Facing Apartment",
        "description": "Prestigious 3BHK sea-facing apartment offering breathtaking sunset views, world-class club amenities, and 24/7 concierge service.",
        "property_type": "Apartment",
        "listing_type": "Rent",
        "price": 110000,
        "location": "Bandra West",
        "city": "Mumbai",
        "bedrooms": 3,
        "bathrooms": 3,
        "area_sqft": 2100,
        "furnishing": "Fully Furnished",
        "amenities": ["Sea View", "Concierge", "Valet Parking", "Gym & Spa", "Clubhouse", "Security Guard"],
        "images": [
            "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200",
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200"
        ],
        "featured": True,
        "verified": True,
    }
]


def initialize():
    db.create_all()

    # 1. Ensure Admin Account
    admin_email = os.getenv("ADMIN_EMAIL", "admin@househunt.com").strip().lower()
    admin_pw = os.getenv("ADMIN_PASSWORD")
    if not admin_pw:
        raise RuntimeError("ADMIN_PASSWORD must be configured before initializing the database")
    admin = User.query.filter_by(email=admin_email).first()
    if not admin:
        admin = User(
            name="House Hunt Admin",
            email=admin_email,
            role="admin",
            status="active",
            phone="+91 98765 43210",
            password_hash=bcrypt.hashpw(admin_pw.encode(), bcrypt.gensalt()).decode()
        )
        db.session.add(admin)
        db.session.commit()
    else:
        # Guarantee role is admin
        if admin.role != "admin":
            admin.role = "admin"
            db.session.commit()

    # 2. Ensure Test User Account
    user_email = "john@example.com"
    test_user = User.query.filter_by(email=user_email).first()
    if not test_user:
        test_user = User(
            name="John Doe",
            email=user_email,
            role="user",
            status="active",
            phone="+91 91234 56789",
            password_hash=bcrypt.hashpw("Password@123".encode(), bcrypt.gensalt()).decode()
        )
        db.session.add(test_user)
        db.session.commit()

    # 3. Seed Properties if none exist
    active_properties = Property.query.filter(Property.listing_status != "Deleted").count()
    if active_properties == 0 or os.getenv("SEED_DATA", "1") == "1" and active_properties < len(SAMPLE_PROPERTIES):
        for item in SAMPLE_PROPERTIES:
            existing = Property.query.filter_by(title=item["title"]).first()
            if not existing:
                prop = Property(
                    title=item["title"],
                    description=item["description"],
                    property_type=item["property_type"],
                    listing_type=item["listing_type"],
                    price=item["price"],
                    location=item["location"],
                    city=item["city"],
                    bedrooms=item["bedrooms"],
                    bathrooms=item["bathrooms"],
                    area_sqft=item["area_sqft"],
                    furnishing=item["furnishing"],
                    amenities=item["amenities"],
                    images=item["images"],
                    featured=item["featured"],
                    verified=item["verified"],
                    owner_id=admin.id,
                    listing_status="Available"
                )
                db.session.add(prop)
        db.session.commit()


# Synchronize schema and seed admin on WSGI startup or direct run
with app.app_context():
    try:
        initialize()
    except Exception as exc:
        app.logger.warning("Database initialization notice on startup: %s", exc)


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("FLASK_PORT", "8081")))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"Starting House Hunt Flask server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)

