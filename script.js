function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(
    (seconds % 3600) / 60
  )}m ${seconds % 60}s`;
}

function parseDuration(text) {
  const parts = text.match(/\d+h|\d+m|\d+s/g) || [];
  let total = 0;
  parts.forEach((part) => {
    if (part.includes("h")) total += parseInt(part) * 3600;
    else if (part.includes("m")) total += parseInt(part) * 60;
    else if (part.includes("s")) total += parseInt(part);
  });
  return total;
}

function updateProgressBar(completed, total, hasTime = true) {
  const percent =
    total === 0
      ? "0"
      : parseFloat(((completed / total) * 100).toFixed(2)).toString();
  const bar = document.querySelector(".overall-course-progress .progress-bar");
  const text = document.getElementById("overall-progress-text");

  const label = hasTime
    ? `${formatDuration(completed)} of ${formatDuration(total)} (${percent}%)`
    : `${completed} of ${total} topics (${percent}%)`;

  bar.style.width = `${percent}%`;
  text.textContent = label;
}

function updateProgressBarFromDOM() {
  const items = Array.from(document.querySelectorAll(".topic-list-item"));
  let completed = 0;
  let total = 0;

  const hasTime = items.some((item) => {
    const durationText = item.querySelector(".topic-duration").textContent;
    return parseDuration(durationText) > 0;
  });

  items.forEach((item) => {
    const completedCheckbox = item.querySelector('input[name="completed"]');
    const durationText = item.querySelector(".topic-duration").textContent;
    const timeInSec = parseDuration(durationText);

    if (hasTime) {
      total += timeInSec;
      if (completedCheckbox.checked) completed += timeInSec;
    } else {
      total += 1;
      if (completedCheckbox.checked) completed += 1;
    }
  });

  updateProgressBar(completed, total, hasTime);
}

function updateTodayTargetProgress() {
  const items = Array.from(document.querySelectorAll(".topic-list-item"));
  const targetItems = items.filter((item) => {
    const todoCheckbox = item.querySelector('input[name="to-do"]');
    return todoCheckbox && todoCheckbox.checked;
  });

  let completed = 0;
  let total = 0;

  const hasTime = targetItems.some((item) => {
    const durationText = item.querySelector(".topic-duration").textContent;
    return parseDuration(durationText) > 0;
  });

  targetItems.forEach((item) => {
    const completedCheckbox = item.querySelector('input[name="completed"]');
    const durationText = item.querySelector(".topic-duration").textContent;
    const timeInSec = parseDuration(durationText);

    if (hasTime) {
      total += timeInSec;
      if (completedCheckbox.checked) completed += timeInSec;
    } else {
      total += 1;
      if (completedCheckbox.checked) completed += 1;
    }
  });

  const bar = document.querySelector(
    ".today-target-course-progress .progress-bar"
  );
  const text = document.getElementById("today-progress-text");

  const percent =
    total === 0
      ? "0"
      : parseFloat(((completed / total) * 100).toFixed(2)).toString();

  const label = hasTime
    ? `${formatDuration(completed)} of ${formatDuration(total)} (${percent}%)`
    : `${completed} of ${total} topics (${percent}%)`;

  bar.style.width = `${percent}%`;
  text.textContent = label;
}

function saveCourseProgress(courseId) {
  const completed = [];
  const todo = [];

  document.querySelectorAll(".topic-list-item").forEach((item) => {
    const completedCheckbox = item.querySelector('input[name="completed"]');
    const todoCheckbox = item.querySelector('input[name="to-do"]');
    const topicId = Number(item.dataset.id);

    if (completedCheckbox.checked) completed.push(topicId);
    if (todoCheckbox.checked) todo.push(topicId);
  });

  const progress = {
    completed,
    todo,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem(`progress-${courseId}`, JSON.stringify(progress));
}

function renderCourse(data, savedProgress, courseId) {
  const list = document.getElementById("course-list");
  list.innerHTML = "";

  data.forEach((chapter) => {
    const li = document.createElement("li");
    li.className = "course-chapter";

    const heading = document.createElement("p");
    heading.className = "course-chapter-heading";
    heading.innerHTML = `
      <span class="chapter-title">
        ${chapter.object_index}. ${chapter.title}
        <span class="chapter-tick">✔️</span>
      </span>
      <span>${formatDuration(chapter.time_duration)}</span>
    `;

    const topicsUl = document.createElement("ul");
    topicsUl.className = "chapter-topics collapsed";

    chapter.topics.forEach((topic) => {
      const topicLi = document.createElement("li");
      topicLi.className = "topic-list-item";
      topicLi.dataset.id = topic.id;

      const completed = document.createElement("input");
      completed.type = "checkbox";
      completed.name = "completed";
      completed.checked = savedProgress.completed.includes(topic.id);

      const nameSpan = document.createElement("span");
      nameSpan.className = "topic-name";
      nameSpan.textContent = `${topic.object_index}. ${topic.title}`;

      const durationSpan = document.createElement("span");
      durationSpan.className = "topic-duration";
      durationSpan.textContent = formatDuration(topic.time_duration);

      const todo = document.createElement("input");
      todo.type = "checkbox";
      todo.name = "to-do";
      todo.checked = savedProgress.todo.includes(topic.id);

      topicLi.appendChild(completed);
      topicLi.appendChild(nameSpan);
      topicLi.appendChild(durationSpan);
      topicLi.appendChild(todo);

      topicsUl.appendChild(topicLi);
    });

    heading.addEventListener("click", () => {
      const isExpanded = topicsUl.classList.contains("expanded");
      if (isExpanded) {
        const currentHeight = topicsUl.scrollHeight;
        topicsUl.style.height = `${currentHeight}px`;
        requestAnimationFrame(() => {
          topicsUl.style.height = "0px";
        });
        topicsUl.classList.remove("expanded");
      } else {
        topicsUl.style.height = "auto";
        const targetHeight = topicsUl.scrollHeight + "px";
        topicsUl.style.height = "0px";
        topicsUl.classList.add("expanded");
        requestAnimationFrame(() => {
          topicsUl.style.height = targetHeight;
        });
      }
    });

    topicsUl.addEventListener("transitionend", () => {
      if (topicsUl.classList.contains("expanded")) {
        topicsUl.style.height = "auto";
      }
    });

    const tick = heading.querySelector(".chapter-tick");
    const chapterTitle = heading.querySelector(".chapter-title");

    function updateTickStatus() {
      const checkboxes = topicsUl.querySelectorAll('input[name="completed"]');
      const allChecked = [...checkboxes].every((cb) => cb.checked);
      chapterTitle.classList.toggle("completed", allChecked);
      li.classList.toggle("completed", allChecked);

      updateProgressBarFromDOM();
      updateTodayTargetProgress();
      saveCourseProgress(courseId);
    }

    topicsUl
      .querySelectorAll('input[name="completed"], input[name="to-do"]')
      .forEach((cb) => {
        cb.addEventListener("change", updateTickStatus);
      });

    updateTickStatus();

    li.appendChild(heading);
    li.appendChild(topicsUl);
    list.appendChild(li);
  });
}

const groupLecturesByChapters = (data) => {
  const chapters = [];
  let currentChapter = null;
  let courseDuration = 0;

  for (let item of data) {
    if (item._class === "chapter") {
      currentChapter = { ...item, time_duration: 0, topics: [] };
      chapters.push(currentChapter);
    } else {
      const duration = item.asset?.time_estimation || 0;
      item = { ...item, time_duration: duration };
      currentChapter.time_duration += duration;
      courseDuration += duration;

      const { asset, ...updatedItem } = item;
      currentChapter.topics.push(updatedItem);
    }
  }

  return [chapters, courseDuration];
};

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("course");

  if (!courseId || !courses[courseId]) {
    alert("Invalid course selected.");
    return;
  }

  document.getElementById("course-title").textContent = courses[courseId].name;

  try {
    const res = await fetch(courses[courseId].dataUrl);
    const rawData = await res.json();

    const [courseData, courseDuration] = groupLecturesByChapters(
      rawData.results
    );

    const rawProgress = localStorage.getItem(`progress-${courseId}`);
    const savedProgress = rawProgress
      ? JSON.parse(rawProgress)
      : { completed: [], todo: [] };

    renderCourse(courseData, savedProgress, courseId);

    updateProgressBarFromDOM();
    updateTodayTargetProgress();
  } catch (err) {
    alert("Failed to load course content.");
    console.error(err);
  }
});

document.getElementById("reset-today-target").addEventListener("click", () => {
  document.querySelectorAll('input[name="to-do"]').forEach((checkbox) => {
    checkbox.checked = false;
  });

  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("course");
  saveCourseProgress(courseId);

  setTimeout(() => {
    updateTodayTargetProgress();
  }, 0);
});
