"""Comprehensive automated test suite for House Hunt backend.
Tests all endpoints, authentication, validation, roles, and database integrity.
"""
import unittest
import json
import uuid
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import app, db, User, Property, Favorite, Inquiry, Booking


class HouseHuntTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_01_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "connected")

    def test_02_registration_validation(self):
        # Missing required fields
        res = self.client.post("/api/auth/register", json={})
        self.assertEqual(res.status_code, 400)

        # Password too short (<6)
        res = self.client.post("/api/auth/register", json={
            "name": "Short Pw",
            "email": "short@test.com",
            "password": "123"
        })
        self.assertEqual(res.status_code, 400)

        # Invalid email format
        res = self.client.post("/api/auth/register", json={
            "name": "Invalid Email",
            "email": "not-an-email",
            "password": "validpassword123"
        })
        self.assertEqual(res.status_code, 400)

    def test_03_registration_success_and_duplicate(self):
        test_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
        res = self.client.post("/api/auth/register", json={
            "name": "Test User",
            "email": test_email,
            "phone": "9876543210",
            "password": "Password123!"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], test_email)
        self.assertEqual(data["user"]["role"], "user")  # Role must always default to user

        # Attempt duplicate registration
        res2 = self.client.post("/api/auth/register", json={
            "name": "Duplicate User",
            "email": test_email,
            "password": "Password123!"
        })
        self.assertEqual(res2.status_code, 409)

    def test_04_login_and_profile(self):
        # Admin login
        res = self.client.post("/api/auth/login", json={
            "email": "admin@househunt.com",
            "password": "Admin@123456"
        })
        self.assertEqual(res.status_code, 200)
        admin_data = res.get_json()
        admin_token = admin_data["token"]
        self.assertEqual(admin_data["user"]["role"], "admin")

        # Wrong password
        res_fail = self.client.post("/api/auth/login", json={
            "email": "admin@househunt.com",
            "password": "WrongPassword!"
        })
        self.assertEqual(res_fail.status_code, 401)

        # Get profile with token
        res_me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()["email"], "admin@househunt.com")

        # Update profile
        res_update = self.client.put("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, json={
            "name": "House Hunt Super Admin",
            "phone": "+91 99999 88888"
        })
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.get_json()["name"], "House Hunt Super Admin")

    def test_05_properties_and_filtering(self):
        # Get all properties
        res = self.client.get("/api/properties")
        self.assertEqual(res.status_code, 200)
        props = res.get_json()
        self.assertGreater(len(props), 0)

        # Filter by type: Villa
        res_villas = self.client.get("/api/properties?type=Villa")
        self.assertEqual(res_villas.status_code, 200)
        for p in res_villas.get_json():
            self.assertEqual(p["type"], "Villa")

        # Filter by bedrooms
        res_beds = self.client.get("/api/properties?bedrooms=3")
        self.assertEqual(res_beds.status_code, 200)
        for p in res_beds.get_json():
            self.assertGreaterEqual(p["bedrooms"], 3)

        # Get single property
        first_id = props[0]["id"]
        res_detail = self.client.get(f"/api/properties/{first_id}")
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.get_json()["id"], first_id)

    def test_06_favorites_workflow(self):
        # Login test user
        res_login = self.client.post("/api/auth/login", json={
            "email": "john@example.com",
            "password": "Password@123"
        })
        token = res_login.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get first property
        props = self.client.get("/api/properties").get_json()
        prop_id = props[0]["id"]

        # Add to favorites
        res_add = self.client.post(f"/api/favorites/{prop_id}", headers=headers)
        self.assertEqual(res_add.status_code, 201)

        # Get favorites
        res_get = self.client.get("/api/favorites", headers=headers)
        self.assertEqual(res_get.status_code, 200)
        fav_ids = [p["id"] for p in res_get.get_json()]
        self.assertIn(prop_id, fav_ids)

        # Remove from favorites
        res_del = self.client.delete(f"/api/favorites/{prop_id}", headers=headers)
        self.assertEqual(res_del.status_code, 204)

        # Verify removal
        res_get2 = self.client.get("/api/favorites", headers=headers)
        fav_ids2 = [p["id"] for p in res_get2.get_json()]
        self.assertNotIn(prop_id, fav_ids2)

    def test_07_inquiries_workflow(self):
        props = self.client.get("/api/properties").get_json()
        prop_id = props[0]["id"]

        # Submit inquiry
        res = self.client.post("/api/inquiries", json={
            "propertyId": prop_id,
            "name": "Sarah Connor",
            "email": "sarah@example.com",
            "phone": "9887766554",
            "message": "Is this apartment available for immediate lease?"
        })
        self.assertEqual(res.status_code, 201)
        inq_data = res.get_json()
        self.assertIn("id", inq_data)
        inq_id = inq_data["id"]

        # Admin view inquiries
        admin_login = self.client.post("/api/auth/login", json={"email": "admin@househunt.com", "password": "Admin@123456"})
        admin_headers = {"Authorization": f"Bearer {admin_login.get_json()['token']}"}
        res_inqs = self.client.get("/api/admin/inquiries", headers=admin_headers)
        self.assertEqual(res_inqs.status_code, 200)

        # Admin update inquiry status
        res_upd = self.client.put(f"/api/admin/inquiries/{inq_id}", headers=admin_headers, json={"status": "Contacted"})
        self.assertEqual(res_upd.status_code, 200)
        self.assertEqual(res_upd.get_json()["status"], "Contacted")

    def test_08_admin_authorization_protection(self):
        # Login regular user
        user_login = self.client.post("/api/auth/login", json={"email": "john@example.com", "password": "Password@123"})
        user_headers = {"Authorization": f"Bearer {user_login.get_json()['token']}"}

        # Regular user trying to access admin stats must get 403 Forbidden
        res_stats = self.client.get("/api/admin/stats", headers=user_headers)
        self.assertEqual(res_stats.status_code, 403)

        # Regular user trying to access admin users must get 403 Forbidden
        res_users = self.client.get("/api/admin/users", headers=user_headers)
        self.assertEqual(res_users.status_code, 403)

        # Admin accessing stats gets 200 OK
        admin_login = self.client.post("/api/auth/login", json={"email": "admin@househunt.com", "password": "Admin@123456"})
        admin_headers = {"Authorization": f"Bearer {admin_login.get_json()['token']}"}
        res_admin_stats = self.client.get("/api/admin/stats", headers=admin_headers)
        self.assertEqual(res_admin_stats.status_code, 200)
        data = res_admin_stats.get_json()
        self.assertIn("totalProperties", data)
        self.assertIn("totalUsers", data)
        self.assertIn("totalInquiries", data)


if __name__ == "__main__":
    unittest.main()
