import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.http import JsonResponse
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse

from .models import User, Post


def index(request):
    return render(request, "network/index.html")


def all(request):
    posts = Post.objects.all().order_by("-timestamp")

    page_number = request.GET.get("page", 1)

    paginator = Paginator(posts, 10)  # 10 posts per page
    page_obj = paginator.get_page(page_number)

    return JsonResponse({
        "posts": [post.serialize(request.user) for post in page_obj.object_list],
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
        "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
        "previous_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None
    })


@login_required
def following(request):
    followed_users = request.user.following.all()
    posts = Post.objects.filter(author__in=followed_users).order_by("-timestamp")

    page_number = request.GET.get("page", 1)
    paginator = Paginator(posts, 10)
    page_obj = paginator.get_page(page_number)

    return JsonResponse({
        "posts": [post.serialize(request.user) for post in page_obj.object_list],
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
        "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
        "previous_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None
    })



def profile(request, user_id):
    # Prefetch related users to avoid N+1 queries in serialize()
    user = get_object_or_404(
        User.objects.prefetch_related('following', 'followers'), 
        pk=user_id
    )

    if request.method == "PUT":
        me = request.user

        if me == user:
            return JsonResponse({"error": "Cannot follow yourself."}, status=400)

        # Toggle follow
        if me in user.followers.all():
            user.followers.remove(me)
            is_following = False
        else:
            user.followers.add(me)
            is_following = True

        return JsonResponse({
            "is_following": is_following,
            "followers_count": user.followers.count()
        })

    return JsonResponse({
        "id": user.id,
        "username": user.username,
        "following_count": user.following.count(),
        "followers_count": user.followers.count(),
        "is_following": request.user.is_authenticated and
                        (request.user in user.followers.all())
    })


@login_required
def create(request):
    # Create a new post must be via POST
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=400)
    
    data = json.loads(request.body)
    content = data.get("content")
    if content == "":
        return JsonResponse({
            "error": "The post is empty."
        }, status=400)
    
    post = Post(
        author=request.user,
        content=content
    )
    post.save()

    return JsonResponse({"message": "Post created successfully."}, status=201)


@login_required
def post(request, post_id):
    if request.method == "PUT":
        try:
            post = Post.objects.get(pk=post_id)
        except Post.DoesNotExist:
            return HttpResponse(status=404)
        
        user = request.user

        # 🔹 If there is a body with "content", treat as EDIT
        if request.body:
            try:
                data = json.loads(request.body)
            except json.JSONDecodeError:
                data = {}

            new_content = data.get("content")
            if new_content is not None:
                # ✅ Security: only the author can edit
                if post.author != user:
                    return JsonResponse({"error": "You cannot edit this post."}, status=403)

                new_content = new_content.strip()
                if new_content == "":
                    return JsonResponse({"error": "Post content cannot be empty."}, status=400)

                post.content = new_content
                post.edited = True
                post.save()

                # Return updated post data
                return JsonResponse(post.serialize(user))

        # 🔹 Otherwise, treat as LIKE / UNLIKE
        if post.likes.filter(pk=user.pk).exists():
            post.likes.remove(user)
            is_liked = False
        else:
            post.likes.add(user)
            is_liked = True

        return JsonResponse({
            "is_liked": is_liked,
            "new_count": post.likes.count()
        })
    
    else:
        return JsonResponse({
            "error": "GET or PUT request required."
        }, status=400)



def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "network/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "network/login.html")


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
            return render(request, "network/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "network/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "network/register.html")
