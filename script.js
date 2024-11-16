let deleteFileId = null;

// Google API constants
const CLIENT_ID = "874922187178-fptorkdo5dgnppoad0lf2dmr1q5hbvrd.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04XX6kzypod13CgYIARAAGAQSNwF-L9Irh7OAsMq9Q0v2QGuRsGbt1HMVJ_wY37uhXbmENfuOkbZp5eGrS_JRdD6v8B_OOmbu8as";

// Helper to save state to localStorage
function saveState(fileId, timeLeft, status) {
  const state = {
    timeLeft,
    status,
    startTime: Date.now() // Save the current timestamp
  };
  localStorage.setItem(fileId, JSON.stringify(state));
}

// Helper to load state from localStorage
function loadState(fileId) {
  const state = localStorage.getItem(fileId);
  return state ? JSON.parse(state) : null;
}

// Fetch access token using refresh token
async function fetchAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

// Fetch files from Google Drive
async function fetchGoogleDriveFiles() {
  const accessToken = await fetchAccessToken();
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id,name,size,createdTime,owners)', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  const files = data.files;
  const fileListContainer = document.getElementById('fileList');
  fileListContainer.innerHTML = '';

  files.forEach((file) => {
    const fileSize = (file.size / 1024).toFixed(2);
    const uploadDate = new Date(file.createdTime).toLocaleString();
    const fileOwner = file.owners ? file.owners[0].displayName : "Unknown";
    const storedState = loadState(file.id);
    let timerText = '';
    let statusText = 'Pending';

    if (storedState) {
      // Calculate remaining time
      const elapsedTime = Math.floor((Date.now() - storedState.startTime) / 1000);
      const remainingTime = storedState.timeLeft - elapsedTime;

      if (remainingTime > 0) {
        timerText = `Time left: ${Math.floor(remainingTime / 60)}:${remainingTime % 60}`;
        storedState.timeLeft = remainingTime; // Update timeLeft
        saveState(file.id, remainingTime, storedState.status); // Save updated time
      } else {
        timerText = 'File has been deleted!';
        storedState.status = 'Deleted'; // Update status
        saveState(file.id, 0, 'Deleted');
      }
      statusText = storedState.status;
    }

    const fileItem = document.createElement('div');
    fileItem.classList.add('file-item');
    fileItem.setAttribute('data-file-id', file.id);

    fileItem.innerHTML = `
      <div class="file-details">
        <p class="file-name">File Name: ${file.name}</p>
        <p class="file-info">File Size: ${fileSize} KB</p>
        <p class="file-info">Uploaded By: ${fileOwner}</p>
        <p class="file-info">Upload Time: ${uploadDate}</p>
        <p class="file-info timer" id="timer-${file.id}">${timerText}</p>
        <p class="file-info status" id="status-${file.id}">Status: ${statusText}</p>
      </div>
      <div class="file-actions">
        <button onclick="previewFile('${file.id}')">Preview</button>
      </div>
    `;
    fileListContainer.appendChild(fileItem);

    if (storedState && storedState.timeLeft > 0) {
      startDeletionTimer(file.id, storedState.timeLeft);
    }
  });
}

// Preview file in modal
async function previewFile(fileId) {
  const accessToken = await fetchAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const fileBlob = await response.blob();
  const fileURL = URL.createObjectURL(fileBlob);

  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `<iframe src="${fileURL}" width="100%" height="500px" style="border: none;"></iframe>`;
  document.getElementById('previewModal').style.display = "block";

  deleteFileId = fileId;
}

// Start deletion timer
function startDeletionTimer(fileId, initialTimeLeft = 5 * 60) {        //set time 5 Sec
  const timerElement = document.getElementById(`timer-${fileId}`);
  const statusElement = document.getElementById(`status-${fileId}`);
  let timeLeft = initialTimeLeft;

  const interval = setInterval(async () => {
    if (timeLeft <= 0) {
      clearInterval(interval);
      await deleteFile(fileId);
      removeFileFromList(fileId);
      statusElement.textContent = 'File has been deleted!';
      saveState(fileId, 0, 'Deleted');
    } else {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerElement.textContent = `Time left: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
      saveState(fileId, timeLeft, statusElement.textContent.includes('Successful') ? 'Successful' : 'Pending');
    }
    timeLeft--;
  }, 1000);
}

// Delete file from Google Drive
async function deleteFile(fileId) {
  const accessToken = await fetchAccessToken();
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Remove file from UI
function removeFileFromList(fileId) {
  const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
  if (fileItem) fileItem.remove();
  localStorage.removeItem(fileId);
}

// Close the preview modal
function closeModal() {
  document.getElementById('previewModal').style.display = 'none';
}

// Print preview
function printPreview() {
  const iframe = document.querySelector('#modalBody iframe');
  if (iframe) {
    iframe.contentWindow.print();
    const statusElement = document.getElementById(`status-${deleteFileId}`);
    statusElement.textContent = "Status: Successful";
    saveState(deleteFileId, 5 * 60, 'Successful');
    startDeletionTimer(deleteFileId, 5 * 60);
  }
}

// Filter files
function filterFiles() {
  const searchTerm = document.querySelector('.search-bar input').value.toLowerCase();
  const fileItems = document.querySelectorAll('.file-item');
  fileItems.forEach((item) => {
    const fileName = item.querySelector('.file-name').textContent.toLowerCase();
    item.style.display = fileName.includes(searchTerm) ? 'block' : 'none';
  });
}

// Disable inspect element
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
    e.preventDefault();
  }
});

// Initial file fetch
fetchGoogleDriveFiles();
setInterval(fetchGoogleDriveFiles, 10000); // Auto-refresh every 1 seconds= 1000


