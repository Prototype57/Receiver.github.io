let deletionTimer;
let deleteFileId = null;
let printStatus = {};  // Object to store print status for each file

const CLIENT_ID = "874922187178-fptorkdo5dgnppoad0lf2dmr1q5hbvrd.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04XX6kzypod13CgYIARAAGAQSNwF-L9Irh7OAsMq9Q0v2QGuRsGbt1HMVJ_wY37uhXbmENfuOkbZp5eGrS_JRdD6v8B_OOmbu8as";

async function fetchAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchGoogleDriveFiles() {
  const accessToken = await fetchAccessToken();
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,createdTime,owners)', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const data = await response.json();
  const files = data.files;
  const fileListContainer = document.getElementById('fileList');
  fileListContainer.innerHTML = '';
  files.forEach(file => {
    const fileSize = (file.size / 1024).toFixed(2); // Convert bytes to KB
    const uploadDate = new Date(file.createdTime).toLocaleString(); // Format the upload date and time
    const fileOwner = file.owners ? file.owners[0].displayName : "Unknown";
    const fileItem = document.createElement('div');
    fileItem.classList.add('file-item');
    fileItem.setAttribute('data-file-id', file.id);  // Add data-file-id attribute
    fileItem.innerHTML = `
      <div class="file-details">
        <div class="file-name">File Name: ${file.name}</div>
        <div class="file-info">File Size: ${fileSize} KB</div>
        <div class="file-info">Uploaded By: ${fileOwner}</div>
        <div class="file-info">Upload Time: ${uploadDate}</div>
        <div class="deletion-timer" id="timer-${file.id}" style="display: none;"></div>
        <div class="file-status" id="status-${file.id}" class="status-pending">Status: Pending</div>
      </div>
      <div class="file-actions">
        <button onclick="previewFile('${file.id}')">Preview</button>
      </div>
    `;
    fileListContainer.appendChild(fileItem);
  });
}

async function previewFile(fileId) {
  const accessToken = await fetchAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const fileBlob = await response.blob();
  const fileURL = URL.createObjectURL(fileBlob);
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <iframe src="${fileURL}" width="100%" height="500px" style="border: none;"></iframe>
  `;
  document.getElementById('previewModal').style.display = "block";
  deleteFileId = fileId;
}

function printPreview() {
  const iframe = document.querySelector('#modalBody iframe');
  if (iframe) {
    iframe.contentWindow.print();
    const statusElement = document.getElementById(`status-${deleteFileId}`);
    statusElement.innerHTML = "Status: Successful";
    statusElement.classList.remove("status-pending");
    statusElement.classList.add("status-success");

    startDeletionTimer(deleteFileId);
  }
}

function startDeletionTimer(fileId) {
  let timeLeft = 5 * 60; // 5 minutes in seconds
  const timerElement = document.getElementById(`timer-${fileId}`);
  timerElement.style.display = 'block';

  const deletionTimer = setInterval(async () => {
    if (timeLeft <= 0) {
      clearInterval(deletionTimer);
      await deleteFile(fileId);
      removeFileFromList(fileId);
      
      const statusElement = document.getElementById(`status-${fileId}`);
      statusElement.textContent = 'File has been deleted!';
    } else {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerElement.innerHTML = `Time left : ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    }
    timeLeft--;
  }, 1000);
}

async function deleteFile(fileId) {
  const accessToken = await fetchAccessToken();
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

function removeFileFromList(fileId) {
  const fileItems = document.querySelectorAll('.file-item');
  fileItems.forEach(item => {
    if (item.dataset.fileId === fileId) {
      item.remove();
    }
  });
}

function closeModal() {
  document.getElementById('previewModal').style.display = 'none';
}

function filterFiles() {
  const searchTerm = document.querySelector('.search-bar input').value.toLowerCase();
  const fileItems = document.querySelectorAll('.file-item');
  fileItems.forEach(item => {
    const fileName = item.querySelector('.file-name').textContent.toLowerCase();
    item.style.display = fileName.includes(searchTerm) ? 'block' : 'none';
  });
}

// Initial load of files
fetchGoogleDriveFiles();

// Disable Inspect Mode
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
    e.preventDefault();
  }
});
