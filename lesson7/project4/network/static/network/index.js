document.addEventListener('DOMContentLoaded', function() {
    // By default, load all posts
    load_posts('all', 1);
    
    // Use buttons to toggle between pages
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', function(event) {
            // Stop the default action of the link (which is to reload the page)
            event.preventDefault();

            // 'this' refers to the link that was clicked
            const page = this.dataset.page; 
            
            if (page) {
                // Load posts for the corresponding page ('all' or 'following')
                load_posts(page, 1);
            }
        })
    })

    const profileLink = document.querySelector('#my-profile');
    if (profileLink) {
        profileLink.addEventListener('click', function(event) {
            event.preventDefault();
            const userId = this.dataset.userId;
            profile(userId);
        });
    }

    create_post();
});


function load_posts(page, pageNumber = 1) {
    const currentUserIdInput = document.querySelector('#current-user-id');
    const currentUserId = currentUserIdInput ? parseInt(currentUserIdInput.value) : null;

    document.querySelector('#post-view').style.display = 'block';
    document.querySelector('#profile-view').style.display = 'none';

    const titleElement = document.querySelector('#page-title');
    if (titleElement) {
        if (page == 'all') {
            titleElement.innerHTML = `All Posts`;
            toggle_create_post_visibility(true);
        } else if (page == 'following') {
            titleElement.innerHTML = `Following`;
            toggle_create_post_visibility(false);
        }
    }

    const container = document.querySelector('#post-view');
    // Clear the container before loading new content
    container.innerHTML = '';

    const paginationContainer = document.querySelector('#pagination-controls');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }

    fetch(`/${page}?page=${pageNumber}`)
    .then(response => response.json().then(data => ({
        status: response.status,
        body: data
    })))
    .then(result => {
        if (result.status !== 200) {
            container.innerHTML = `<p class="text-danger">${result.body.error || 'Failed to load posts.'}</p>`;
            return
        }

        const data = result.body;
        const posts = data.posts || [];

        if (posts.length === 0) {
            container.innerHTML += `<p class="text-muted">There is no post in Network.</p>`;
            return;
        }

        posts.forEach(post => {
            // Create the main container for the post
            const postContainer = document.createElement('div');
            
            // Add custom class for styling
            postContainer.className = 'post-item';

            let editButtonHTML = '';
            if (currentUserId && currentUserId === post.author_id) {
                editButtonHTML = `
                    <button class="post-edit-btn btn btn-sm btn-outline-secondary ml-2" data-post-id="${post.id}">
                        Edit
                    </button>
                `;
            }
            
            postContainer.innerHTML = `
                <div class="post-header">
                    <a href="#" class="post-author" data-user-id="${post.author_id}">${post.author}</a> 
                    <small class="post-timestamp">
                        ${post.timestamp} ${post.edited ? "(edited)" : ""}
                    </small>
                </div>
                
                <p class="post-content">${post.content}</p>
                
                <hr class="post-divider">

                <div class="post-footer">
                    <span class="post-likes">Likes: <strong>${post.like_count}</strong></span>
                    
                    <button class="post-like-btn" data-post-id="${post.id}">
                        ${post.is_liked ? "Unlike" : "Like"}
                    </button>

                    ${editButtonHTML}
                </div>
            `;

            const likeButton = postContainer.querySelector('.post-like-btn');
            likeButton.addEventListener('click', function() {
                like_unlike_post(post.id, likeButton);
            });

            const authorLink = postContainer.querySelector('.post-author');
            authorLink.addEventListener('click', function(event) {
                event.preventDefault();
                const userId = this.dataset.userId;
                profile(userId);
            });

            const editButton = postContainer.querySelector('.post-edit-btn');
            if (editButton) {
                editButton.addEventListener('click', function() {
                    start_edit_post(post, postContainer);
                });
            }

            container.append(postContainer);
        });

        if (paginationContainer) {
            if (data.has_previous) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'btn btn-sm btn-outline-secondary mr-2';
                prevBtn.innerText = 'Previous';
                prevBtn.addEventListener('click', function() {
                    load_posts(page, data.previous_page_number);
                });
                paginationContainer.append(prevBtn);
            }

            if (data.has_next) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn btn-sm btn-outline-secondary';
                nextBtn.innerText = 'Next';
                nextBtn.addEventListener('click', function() {
                    load_posts(page, data.next_page_number);
                });
                paginationContainer.append(nextBtn);
            }
        }
    })
}


function like_unlike_post(postID, buttonElement) {

// Safely retrieve the hidden input element
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]');
    // If the token element is NOT found, stop the function.
    if (!tokenElement) {
        console.error("CSRF token element not found in the DOM. Cannot perform PUT request.");
        return; // Stop execution
    }
    // Define and assign the token value
    const csrftoken = tokenElement.value; // Now we know tokenElement exists    
    
    fetch(`/posts/${postID}`, {
        method: 'PUT',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json' 
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }
        return response.json();
    })
    .then(data => {
        // Find the likes counter and update it
        buttonElement.closest('.post-footer').querySelector('.post-likes strong').innerHTML = data.new_count;

        // Change the button text/style
        if (data.is_liked) {
            console.log('Like post successfully!');
            buttonElement.innerHTML = "Unlike"
        } else {
            console.log('Unlike post successfully!');
            buttonElement.innerHTML = "Like"
        }
    })
    .catch(error => {
            console.error('There was a problem with the like operation:', error);
    });
}


function create_post() {
    const createForm = document.querySelector('#create-form');

    if (createForm) {
        createForm.onsubmit = function(event) {
            event.preventDefault();
            const contentElement = document.querySelector('#create-content');
            const contentValue = contentElement.value.trim();

            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (contentValue === "") {
                alert("Write something to create a post!");
                return;
            }

            fetch('/posts', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken, // Add token here
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: contentValue
                })
            })
            .then(response => response.json().then(data => ({
                status: response.status,
                body: data
            })))
            .then(result => {
                if (result.status == 201) {
                    console.log('Post created successfully!');
                    load_posts('all');
                    document.querySelector('#create-form').reset();
                } else {
                    alert(result.body.error || "Fail to create post.");
                }
            })
            .catch(error => {
                console.error('There was a problem with posting function:', error);
            });
        }
    }
}


function profile(userId) {
    document.querySelector('#post-view').style.display = 'none';
    document.querySelector('#profile-view').style.display = 'block';
 
    // Get the ID of the currently logged-in user from the hidden input
    const currentUserIdInput = document.querySelector('#current-user-id');
    const currentUserId = currentUserIdInput ? currentUserIdInput.value : null;

    // Show the create form ONLY IF the profile ID matches the current user's ID
    const isOwner = (currentUserId && userId.toString() === currentUserId.toString());
    toggle_create_post_visibility(isOwner);
    
    document.querySelector('#page-title').innerHTML = `Profile`;

    const profileContainer = document.querySelector('#profile-view');
    // Clear the container before loading new content
    profileContainer.innerHTML = '';

    fetch(`/profile/${userId}`)
    .then(response => response.json().then(data => ({
        status: response.status,
        body: data
    })))
    .then(result => {
        if (result.status !== 200) {
            profileContainer.innerHTML = `<p class="text-danger">${result.body.error || 'Failed to load profile.'}</p>`;
            return
        }

        const user = result.body;

        let followBtnHTML = "";
        if (!isOwner) {
            followBtnHTML = `
                <button id="follow-btn" class="btn btn-sm btn-outline-primary mt-3">
                    ${user.is_following ? "Unfollow" : "Follow"}
                </button>
            `;
        }

        profileContainer.innerHTML = `
            <div class="card p-3">
                <h3>${user.username}</h3>
                <hr>
                <strong>Following:</strong> ${user.following_count}<br>
                <strong>Followers:</strong> 
                    <span id="followers-count">${user.followers_count}</span><br>
                ${followBtnHTML}
            </div>
        `;

        if (!isOwner) {
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            document.querySelector('#follow-btn').onclick = function() {
                fetch(`/profile/${userId}`, {
                    method: "PUT",
                    headers: {
                        "X-CSRFToken": csrftoken,
                        "Content-Type": "application/json"
                    }
                })
                .then(response => response.json())
                .then(data => {
                    // Update button text
                    this.innerHTML = data.is_following ? "Unfollow" : "Follow";

                    // Update follower count
                    document.querySelector('#followers-count').innerHTML =
                        data.followers_count;
                });
            };
        }

    })
}


function toggle_create_post_visibility(isVisible) {
    const createContainer = document.querySelector('#create-post-container');
    if (createContainer) {
        createContainer.style.display = isVisible ? 'block' : 'none';
    }
}


function start_edit_post(post, postContainer) {
    const contentElement = postContainer.querySelector('.post-content');
    const originalText = contentElement.innerText;

    // Create textarea to edit
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control mb-2';
    textarea.value = originalText;

    // Replace <p> with <textarea>
    postContainer.replaceChild(textarea, contentElement);

    const footer = postContainer.querySelector('.post-footer');
    const likeButton = footer.querySelector('.post-like-btn');
    const editButton = footer.querySelector('.post-edit-btn');

    // Hide Like + Edit while editing
    if (likeButton) likeButton.style.display = 'none';
    if (editButton) editButton.style.display = 'none';

    // Create Save & Cancel buttons
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-primary mr-2';
    saveBtn.innerText = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm btn-secondary';
    cancelBtn.innerText = 'Cancel';

    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);

    // Cancel: restore original UI
    cancelBtn.addEventListener('click', function() {
        const restoredP = document.createElement('p');
        restoredP.className = 'post-content';
        restoredP.innerText = originalText;
        postContainer.replaceChild(restoredP, textarea);

        if (likeButton) likeButton.style.display = '';
        if (editButton) editButton.style.display = '';

        saveBtn.remove();
        cancelBtn.remove();
    });

    // Save: send PUT to backend
    saveBtn.addEventListener('click', function() {
        const newContent = textarea.value.trim();
        if (!newContent) {
            alert("Post cannot be empty.");
            return;
        }

        update_post_content(post.id, newContent, function(updatedPost) {
            const updatedP = document.createElement('p');
            updatedP.className = 'post-content';
            updatedP.innerText = updatedPost.content;

            postContainer.replaceChild(updatedP, textarea);
            const timestampEl = postContainer.querySelector('.post-timestamp');
            timestampEl.innerHTML = `${updatedPost.timestamp} (edited)`;

            if (likeButton) likeButton.style.display = '';
            if (editButton) editButton.style.display = '';

            saveBtn.remove();
            cancelBtn.remove();
        });
    });
}


function update_post_content(postID, newContent, onSuccess) {
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]');
    if (!tokenElement) {
        console.error("CSRF token element not found. Cannot edit post.");
        return;
    }
    const csrftoken = tokenElement.value;

    fetch(`/posts/${postID}`, {
        method: 'PUT',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: newContent
        })
    })
    .then(response => response.json().then(data => ({
        status: response.status,
        body: data
    })))
    .then(result => {
        if (result.status !== 200) {
            alert(result.body.error || "Failed to update post.");
            return;
        }

        if (onSuccess) {
            onSuccess(result.body);
        }
    })
    .catch(error => {
        console.error('Error updating post:', error);
    });
}
