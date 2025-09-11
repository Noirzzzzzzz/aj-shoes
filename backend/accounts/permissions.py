from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSuperadmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superadmin())

class IsSubadmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_subadmin())
