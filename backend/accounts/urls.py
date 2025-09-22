from django.urls import path
from .views import (
    RegisterView, MeView,
    SecurityQuestionListView, SetSecurityAnswerView, ForgotPasswordView, ChangePasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("me/", MeView.as_view()),
    path("security-questions/", SecurityQuestionListView.as_view()),
    path("set-security-answer/", SetSecurityAnswerView.as_view()),
    path("forgot-password/", ForgotPasswordView.as_view()),
    path("change-password/", ChangePasswordView.as_view()),  # ✅ ใหม่
]
