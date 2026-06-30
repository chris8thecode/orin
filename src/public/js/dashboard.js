document.addEventListener('DOMContentLoaded', () => {
  const wsStatus = document.getElementById('wsStatus');
  const wsStatusText = document.getElementById('wsStatusText');

  const activeNowEl = document.getElementById('activeNow');
  const todayEl = document.getElementById('today');
  const thisWeekEl = document.getElementById('thisWeek');
  const thisMonthEl = document.getElementById('thisMonth');
  const thisYearEl = document.getElementById('thisYear');
  const totalEl = document.getElementById('total');
  const connectionsList = document.getElementById('connectionsList');

  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      wsStatus.classList.remove('offline');
      wsStatusText.textContent = 'Live';
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'stats') {
          updateStats(message.data);
        } else if (message.type === 'newConnection') {
          showNotification(`New connection: ${message.data.phoneNumber}`);
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    ws.onclose = () => {
      wsStatus.classList.add('offline');
      wsStatusText.textContent = 'Disconnected';

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connectWebSocket, 2000 * reconnectAttempts);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  function updateStats(data) {
    animateValue(activeNowEl, parseInt(activeNowEl.textContent), data.activeNow);
    animateValue(todayEl, parseInt(todayEl.textContent), data.today);
    animateValue(thisWeekEl, parseInt(thisWeekEl.textContent), data.thisWeek);
    animateValue(thisMonthEl, parseInt(thisMonthEl.textContent), data.thisMonth);
    animateValue(thisYearEl, parseInt(thisYearEl.textContent), data.thisYear);
    animateValue(totalEl, parseInt(totalEl.textContent), data.total);

    updateConnectionsList(data.activeConnections);
  }

  function animateValue(element, start, end) {
    if (start === end) return;

    const duration = 300;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);

      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function updateConnectionsList(connections) {
    if (!connections || connections.length === 0) {
      connectionsList.innerHTML = `
                <tr>
                    <td colspan="2" class="empty-state">
                        <div class="icon"></div>
                        <p>No active connections</p>
                    </td>
                </tr>
            `;
      return;
    }

    connectionsList.innerHTML = connections
      .map(
        (conn) => `
            <tr>
                <td>+${conn.phoneNumber}</td>
                <td><span class="badge active">Active</span></td>
            </tr>
        `,
      )
      .join('');
  }

  function showNotification(message) {
    console.log('Notification:', message);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Orin', { body: message });
    }
  }

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  connectWebSocket();

  setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      fetch('/api/stats')
        .then((res) => res.json())
        .then(updateStats)
        .catch(console.error);
    }
  }, 5000);
});
