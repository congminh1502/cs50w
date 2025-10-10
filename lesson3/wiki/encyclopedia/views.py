import markdown2
import random
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse

from . import util


def index(request):
    return render(request, "encyclopedia/index.html", {
        "entries": util.list_entries()
    })


def entry(request, entry):
    # Get raw Markdown content from the util function
    content = util.get_entry(entry)

    # If the entry doesn't exist, show an error page
    if content is None:
        return render(request, "encyclopedia/error.html", {
            "message": f"The entry '{entry}' does not exist."
        })

    # Convert Markdown content to HTML
    html_content = markdown2.markdown(content)

    # Render the entry page with the HTML content
    return render(request, "encyclopedia/entry.html", {
        "entry_title": entry,
        "entry_content": html_content
    })


def search(request):
    q = request.GET.get("q")
    entries = util.list_entries()

    if q in entries:
        return HttpResponseRedirect(reverse("encyclopedia:entry", args=[q]))
    
    matched = [entry for entry in entries if q.lower() in entry.lower()]
    return render(request, "encyclopedia/search.html", {
        "entries": matched,
        "query": q
    })


def new_page(request):
    if request.method == "POST":
        entries = util.list_entries()
        title = request.POST.get("title").strip().capitalize()
        content = request.POST.get("content")

        if title.lower() in [entry.lower() for entry in entries]:
            return render(request, "encyclopedia/error.html", {
                "message": f"The title '{title}' is already existed in the entry list."
            })
        
        util.save_entry(title, content)
        return HttpResponseRedirect(reverse("encyclopedia:entry", args=[title]))
    
    return render(request, "encyclopedia/new_page.html")


def edit(request, entry):
    if request.method == "POST":
        title = entry
        content = request.POST.get("content")
        util.save_entry(title, content)
        return HttpResponseRedirect(reverse("encyclopedia:entry", args=[entry]))

    # Get raw Markdown content from the util function
    content = util.get_entry(entry)

    # Render the edit page
    return render(request, "encyclopedia/edit.html", {
        "entry_title": entry,
        "entry_content": content
    })


def random_page(request):
    # Get random entry
    entries = util.list_entries()
    entry = random.choice(entries)

    return HttpResponseRedirect(reverse("encyclopedia:entry", args=[entry]))