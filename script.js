function formatDuration(seconds) {
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

function updateProgressBar(completed, total) {
  const percent =
    total === 0
      ? "0"
      : parseFloat(((completed / total) * 100).toFixed(2)).toString();

  const bar = document.querySelector(".overall-course-progress .progress-bar");
  const text = document.getElementById("overall-progress-text");

  bar.style.width = `${percent}%`;
  text.textContent = `${formatDuration(completed)} of ${formatDuration(
    total
  )} (${percent}%)`;
}

function updateProgressBarFromDOM() {
  let completed = 0;
  let total = 0;

  document.querySelectorAll(".topic-list-item").forEach((item) => {
    const durationText = item.querySelector(".topic-duration").textContent;
    const completedCheckbox = item.querySelector('input[name="completed"]');

    const timeInSec = parseDuration(durationText);
    total += timeInSec;
    if (completedCheckbox.checked) {
      completed += timeInSec;
    }
  });

  updateProgressBar(completed, total);
}

function updateTodayTargetProgress() {
  let completed = 0;
  let total = 0;

  document.querySelectorAll(".topic-list-item").forEach((item) => {
    const completedCheckbox = item.querySelector('input[name="completed"]');
    const todoCheckbox = item.querySelector('input[name="to-do"]');
    const durationText = item.querySelector(".topic-duration").textContent;

    if (todoCheckbox.checked) {
      const timeInSec = parseDuration(durationText);
      total += timeInSec;

      if (completedCheckbox.checked) {
        completed += timeInSec;
      }
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

  bar.style.width = `${percent}%`;
  text.textContent = `${formatDuration(completed)} of ${formatDuration(
    total
  )} (${percent}%)`;
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
      topicsUl.classList.toggle("collapsed");
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
      item = { ...item, time_duration: item.asset.time_estimation };
      currentChapter.time_duration += item.time_duration;
      courseDuration += item.time_duration;
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
  } catch (err) {
    alert("Failed to load course content.");
    console.error(err);
  }
});
