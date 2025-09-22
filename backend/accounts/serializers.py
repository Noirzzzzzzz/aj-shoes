from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.exceptions import ValidationError

from .models import SecurityQuestion

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    security_question = serializers.PrimaryKeyRelatedField(
        queryset=SecurityQuestion.objects.filter(is_active=True),
        required=False, allow_null=True
    )
    security_answer = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "password",
            "first_name", "last_name",
            "role", "phone", "default_address",
            "security_question", "security_answer",
        ]
        read_only_fields = ["role"]

    def validate_password(self, value):
        try:
            validate_password(value)
        except Exception as e:
            raise ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        security_answer = (validated_data.pop("security_answer", "") or "").strip()

        user = User(**validated_data)
        user.set_password(password)
        # ✅ เก็บเป็น plain text
        user.security_answer = security_answer
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    security_question = serializers.PrimaryKeyRelatedField(
        queryset=SecurityQuestion.objects.filter(is_active=True),
        required=False, allow_null=True
    )
    security_answer = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email",
            "first_name", "last_name",
            "role", "phone", "default_address",
            "security_question", "security_answer",
        ]
        read_only_fields = ["role", "username", "email"]

    def update(self, instance, validated_data):
        sec_answer = validated_data.pop("security_answer", None)
        if sec_answer is not None:
            instance.security_answer = (sec_answer or "").strip()  # ✅ plain text
        return super().update(instance, validated_data)
