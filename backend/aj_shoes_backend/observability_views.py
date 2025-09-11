import json, traceback, uuid
from datetime import datetime
from django.http import JsonResponse
from django.views import View
from django.conf import settings
import logging

logger = logging.getLogger("frontend")

class FrontendLogView(View):
    def post(self, request, *args, **kwargs):
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            body = {"_raw": request.body.decode("utf-8","ignore")}
        rid = str(uuid.uuid4())
        meta = {
            "rid": rid,
            "path": request.META.get("HTTP_X_PAGE_PATH") or body.get("path"),
            "ua": request.META.get("HTTP_USER_AGENT",""),
            "ip": request.META.get("REMOTE_ADDR",""),
            "message": body.get("message"),
            "stack": body.get("stack"),
            "time": datetime.utcnow().isoformat()+"Z",
        }
        logger.error(json.dumps(meta, ensure_ascii=False))
        return JsonResponse({"ok": True, "rid": rid}, status=201)
