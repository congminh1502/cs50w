from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    following = models.ManyToManyField(
        'self', 
        symmetrical=False, 
        related_name="followers", 
        blank=True
    )
    
    def serialize(self):
        return {
            "id": self.id,
            "username": self.username,
            "following": [
                followed_user.username 
                for followed_user in self.following.all()
            ],
            "followers": [
                user.username
                for user in self.followers.all() 
            ],
            "following_count": self.following.count(),
            "followers_count": self.followers.count()
        }


class Post(models.Model):
    author = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name="posts"
    )
    content = models.TextField(max_length=500)
    timestamp = models.DateTimeField(auto_now_add=True)
    likes = models.ManyToManyField(
        User, 
        related_name="liked_posts",
        blank=True
    )
    edited = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.author.username}: {self.content[:30]}"

    def serialize(self, current_user):
        liked_users = [user.username for user in self.likes.all()]

        is_liked = False
        if current_user and current_user.is_authenticated:
            is_liked = self.likes.filter(pk=current_user.pk).exists()

        return {
            "id": self.id,
            "author": self.author.username,
            "author_id": self.author.id,
            "content": self.content,
            "likes": liked_users,
            "like_count": len(liked_users),
            "timestamp": self.timestamp.strftime("%b %d %Y, %I:%M %p"),
            "edited": self.edited,
            "is_liked": is_liked
        }
