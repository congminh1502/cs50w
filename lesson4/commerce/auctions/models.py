from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Max

class User(AbstractUser):
    bio = models.TextField(blank=True)
    profile_image = models.URLField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    
    def __str__(self):
        return self.username


class Category(models.TextChoices):
    FASHION = "Fashion"
    TOYS = "Toys"
    ELECTRONICS = "Electronics"
    HOME = "Home"
    OTHER = "Other"


class Listing(models.Model):
    title = models.CharField(max_length=64)
    description = models.TextField()
    starting_bid = models.DecimalField(max_digits=10, decimal_places=2)
    created_time = models.DateTimeField(auto_now_add=True)
    image = models.URLField(blank=True, null=True)
    category = models.CharField(max_length=32, choices=Category.choices, blank=True, null=True)
    listed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="listed_items")
    is_active = models.BooleanField(default=True)

    watchlist = models.ManyToManyField(User, blank=True, related_name="watchlist_items")

    def __str__(self):
        return f"{self.title} (${self.starting_bid}) by {self.listed_by.username}"

    @property
    def get_current_price(self):
        # Get all bids related to this listing
        bids = self.bids.all()

        # If there are bids, return the highest amount
        if bids.exists():
            highest_bid = bids.aggregate(Max('amount'))['amount__max']
            return highest_bid

        # Otherwise, return the starting bid
        return self.starting_bid


class Bid(models.Model):
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bids")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bids")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    bid_time = models.DateTimeField(auto_now_add=True)


class Comment(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author.username} on {self.listing.title}"