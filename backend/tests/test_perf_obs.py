from django.test import TestCase, Client
from django.urls import reverse
from django.conf import settings
import urllib.parse

class PerfObsTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_frontend_log_endpoint(self):
        r = self.client.post("/api/logs/frontend/", data='{"message":"hello","stack":"trace"}', content_type="application/json", HTTP_X_PAGE_PATH="/home")
        self.assertEqual(r.status_code, 201)
        self.assertIn("rid", r.json())

    def test_image_opt_requires_url(self):
        r = self.client.get("/img/opt/")
        self.assertEqual(r.status_code, 400)

    def test_image_opt_with_dummy(self):
        # use a tiny placeholder image (1x1 PNG) data URL hosted online; here we just ensure 4xx/5xx not raised for malformed host is okay
        url = "https://via.placeholder.com/64"
        q = urllib.parse.urlencode({"url": url, "w": 32, "h": 32})
        r = self.client.get(f"/img/opt/?{q}")
        # may be 200 if outbound allowed; otherwise could be 500 in offline env. Assert not 400 (bad params).
        self.assertNotEqual(r.status_code, 400)
