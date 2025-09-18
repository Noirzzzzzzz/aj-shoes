from django.db import models
from django.conf import settings

class ChatRoom(models.Model):
    """ห้องแชทระหว่างลูกค้า 1 คนกับ admin"""
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="chat_room"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Chat room for {self.customer.username}"
    
    class Meta:
        ordering = ['-updated_at']

class ChatMessage(models.Model):
    """ข้อความในแชท"""
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    image = models.ImageField(upload_to='chat_images/', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.sender.username}: {self.message[:50]}"
    
    class Meta:
        ordering = ['timestamp']