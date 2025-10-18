from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render, redirect
from django.urls import reverse
from decimal import Decimal

from .models import Bid, Category, Comment, Listing, User


def index(request):
    return render(request, "auctions/index.html", {
        "active_listings": Listing.objects.filter(is_active=True)
    })


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            next_url = request.POST.get("next") or reverse("index")
            return redirect(next_url)
        else:
            return render(request, "auctions/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "auctions/login.html", {
            "next": request.GET.get("next", "")
        })


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "auctions/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "auctions/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "auctions/register.html")

@login_required
def create(request):
    if request.method == "POST":
        title = request.POST["title"]
        description = request.POST["description"]
        starting_bid = request.POST["starting_bid"]
        image = request.POST.get("image")
        category = request.POST.get("category")

        listing = Listing(
            title=title,
            description=description,
            starting_bid=starting_bid,
            image=image,
            category=category,
            listed_by=request.user
        )
        listing.save()

        return HttpResponseRedirect(reverse("index"))

    return render(request, "auctions/create.html", {
        "categories": Category.choices
    })


def listing(request, listing_id):
    listing = Listing.objects.get(pk=listing_id)

    # Handle POST requests
    if request.method == "POST":
        # Redirect to login if user not authenticated
        if not request.user.is_authenticated:
            return redirect(f"/login?next=/listing/{listing_id}")

        # Case 1: Owner closes the auction
        if "close_auction" in request.POST:
            if request.user == listing.listed_by and listing.is_active:
                listing.is_active = False
                listing.save()
                messages.success(request, "✅ You have closed this auction.")
            else:
                messages.error(request, "❌ You cannot close this auction.")
            return redirect("listing", listing_id=listing.id)

        # Add comments
        if "add_comment" in request.POST:
            content = request.POST["comment_content"]
            Comment.objects.create(
                listing=listing,
                author=request.user,
                content=content
            )
            messages.success(request, "💬 Comment added successfully!")
            return redirect("listing", listing_id=listing.id)


        # Case 2: Normal user places a bid
        bid_amount = Decimal(request.POST["bid"])
        current_price = listing.get_current_price
        bidder = request.user

        if not listing.is_active:
            messages.error(request, "❌ This auction is closed.")
            return redirect("listing", listing_id=listing.id)

        if request.user == listing.listed_by:
            messages.error(request, "❌ You cannot bid on your own listing.")
            return redirect("listing", listing_id=listing.id)

        if bid_amount <= current_price:
            messages.error(request, "❌ Your bid must be higher than the current price.")
            return redirect("listing", listing_id=listing.id)

        Bid.objects.create(bidder=bidder, amount=bid_amount, listing=listing)
        messages.success(request, "✅ Your bid has been placed successfully!")
        return redirect("listing", listing_id=listing.id)

    # Normal GET request
    return render(request, "auctions/listing.html", {
        "listing": listing
    })


@login_required
def watchlist(request):
    if request.method == "POST":
        listing_id = request.POST.get("listing_id")
        listing = Listing.objects.get(pk=listing_id)

        if "remove_item" in request.POST:
            request.user.watchlist_items.remove(listing)
            messages.success(request, f"❌ Removed '{listing.title}' from your watchlist.")
        elif "add_item" in request.POST:
            request.user.watchlist_items.add(listing)
            messages.success(request, f"✅ Added '{listing.title}' to your watchlist.")

        # redirect back to the listing page if coming from there
        next_url = request.META.get("HTTP_REFERER", reverse("watchlist"))
        return redirect(next_url)

    # GET request (view watchlist page)
    watchlist_items = request.user.watchlist_items.all()
    return render(request, "auctions/watchlist.html", {
        "watchlist_items": watchlist_items
    })