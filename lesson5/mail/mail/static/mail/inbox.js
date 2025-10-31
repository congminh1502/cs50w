document.addEventListener('DOMContentLoaded', function() {

  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);

  // By default, load the inbox
  load_mailbox('inbox');
});

function compose_email() {

  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#content-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Clear out composition fields
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';

  // Save sent email function
  document.querySelector('#compose-form').onsubmit = function(event) {
    event.preventDefault();  // stops page reload!
    const recipients = document.querySelector('#compose-recipients').value;
    const subject = document.querySelector('#compose-subject').value;
    const body = document.querySelector('#compose-body').value;

    fetch('/emails', {
      method: 'POST',
      body: JSON.stringify({
          recipients: recipients,
          subject: subject,
          body: body
      })
    })
      .then(response => response.json().then(data => ({
        status: response.status,
        body: data
      })))
      .then(result => {
        if (result.status == 201) {
          alert(result.body.message);
          load_mailbox('sent');
          document.querySelector('#compose-form').reset();
        } else {
          alert(result.body.error || "Fail to send email.");
        }
      })
      .catch(error => {
        console.log("Network error:", error);
        alert(error.message);
      });
  };
}

function load_mailbox(mailbox) {
  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#content-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'none';

  const container = document.querySelector('#emails-view');
  container.innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;

  // Fetch emails
  fetch(`/emails/${mailbox}`)
    .then(response => response.json().then(data => ({
      status: response.status,
      body: data
    })))
    .then(result => {
      if (result.status !== 200) {
        container.innerHTML += `<p class="text-danger">${result.body.error || 'Failed to load mailbox.'}</p>`;
        return;
      }

      const emails = result.body;

      if (emails.length === 0) {
        container.innerHTML += `<p class="text-muted">No emails in this mailbox.</p>`;
        return;
      }

      // Show each mail summary
      emails.forEach(email => {
        const div = document.createElement('div');
        div.className = email.read ? 'email-item read' : 'email-item unread';
        div.innerHTML = `
          <span class="sender">${email.sender}</span>
          <span class="subject">${email.subject}</span>
          <span class="timestamp">${email.timestamp}</span>
        `;

        // On click → show full content
        div.addEventListener('click', () => {
          document.querySelector('#emails-view').style.display = 'none';
          document.querySelector('#content-view').style.display = 'block';
          document.querySelector('#compose-view').style.display = 'none';

          const content = document.querySelector('#content-view'); 

          // Load full email
          fetch(`/emails/${email.id}`)
            .then(response => response.json().then(data => ({
              status: response.status,
              body: data
            })))
            .then(result => {
              if (result.status !== 200) {
                content.innerHTML = `<p class="text-muted">The email is not found.</p>`;
                return;
              }

              const mail = result.body;
              
              // First clear the content area
              content.innerHTML = '';

              const buttonBar = document.createElement('div');
              buttonBar.className = 'mb-3 d-flex gap-2';
              content.append(buttonBar);
              
              // Archive Button
              const archiveButton = document.createElement('button');
              archiveButton.type = 'button';
              archiveButton.className = 'btn btn-sm btn-outline-dark';
              if (mail.archived) {
                archiveButton.innerHTML = "Unarchive"; 
              } else {
                archiveButton.innerHTML = "Archive";
              }

              archiveButton.addEventListener('click', () => {
                fetch(`/emails/${mail.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                      archived: !mail.archived
                  })
                })
                .then(() => {
                  alert(mail.archived ? "The email has been restored to your mailbox!" : "The email has been archived!");
                  load_mailbox('inbox')
                });  // refresh UI
              })

              buttonBar.append(archiveButton);

              // Auto mark as Read
              fetch(`/emails/${mail.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    read: true
                })
              })

              // Mark as Unread
              if (mailbox != 'sent') {
                const markUnread = document.createElement('button');
                markUnread.type = 'button';
                markUnread.className = 'btn btn-sm btn-outline-dark';
                markUnread.innerHTML = "Mark as Unread"; 

                markUnread.addEventListener('click', () => {
                  fetch(`/emails/${mail.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        read: false
                    })
                  })
                  .then(() => {
                    load_mailbox('inbox')
                  });  // refresh UI
                })
                buttonBar.append(markUnread);
              }

              const emailBlock = document.createElement('div');
              emailBlock.innerHTML = `
                <h3>${mail.subject}</h3>
                <div><strong>From:</strong> ${mail.sender}</div>
                <div><strong>To:</strong> ${mail.recipients.join(', ')}</div>
                <div><strong>Timestamp:</strong> ${mail.timestamp}</div>
                <hr>
                <p>${mail.body}</p>
              `;
              content.append(emailBlock);

              const reply = document.createElement('button');
              reply.type = 'button';
              reply.className = 'btn btn-sm btn-outline-primary';
              reply.innerHTML = "Reply";

              reply.addEventListener('click', () => {
                compose_email();

                // Reply recipient
                let replyTo;
                if (mail.sender === currentUserEmail) {
                  replyTo = Array.isArray(mail.recipients) ? mail.recipients.join(', ') : mail.recipients;
                } else {
                  replyTo = mail.sender;
                }
                document.querySelector('#compose-recipients').value = replyTo;

                // Reply subject
                const subj = mail.subject || '';
                const replySubject = subj.toUpperCase().startsWith('RE:') ? subj : `Re: ${subj}`;
                document.querySelector('#compose-subject').value = replySubject;

                // body quote
                document.querySelector('#compose-body').value = `\n\nOn ${mail.timestamp}, ${mail.sender} wrote:\n${mail.body}`;
              })

              content.append(reply);
            })

            .catch(error => {
              console.error("Network error:", error);
              content.innerHTML = `<p class="text-danger">Network error: ${error.message}</p>`;
            });
        });

        container.append(div);
      });
    })
    .catch(error => {
      console.error("Network error:", error);
      container.innerHTML += `<p class="text-danger">Network error: ${error.message}</p>`;
    });
}
