from rest_framework import serializers
from django.contrib.auth import get_user_model
User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # ✅ เพิ่ม first_name, last_name
        fields = [
            "id", "username", "email", "password",
            "first_name", "last_name",
            "role", "phone", "default_address",
        ]
        read_only_fields = ["role"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # ✅ เพิ่ม first_name, last_name
        fields = [
            "id", "username", "email",
            "first_name", "last_name",
            "role", "phone", "default_address",
        ]
        read_only_fields = ["role"]
