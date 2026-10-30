function formatDuration(seconds) {
  if (seconds === 0) return "0h 0m 0s";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}

function getTopicDuration(item) {
  return Number(item.dataset.duration || 0);
}

function getTopicProgress(item) {
  const slider = item.querySelector('input[name="lecture-progress"]');
  return slider
    ? Number(slider.value)
    : item.querySelector('input[name="completed"]').checked ? 1 : 0;
}

function setProgressBar(selector, textId, completed, total, hasTime) {
  const percent = total === 0 ? "0" : parseFloat(((completed / total) * 100).toFixed(2)).toString();
  document.querySelector(`${selector} .progress-bar`).style.width = `${percent}%`;
  document.getElementById(textId).textContent = hasTime
    ? `${formatDuration(completed)} of ${formatDuration(total)} (${percent}%)`
    : `${completed} of ${total} topics (${percent}%)`;
}

function calculateProgress(items, hasTime = items.some((item) => getTopicDuration(item) > 0)) {
  return items.reduce(
    (progress, item) => {
      if (hasTime) {
        const duration = getTopicDuration(item);
        progress.total += duration;
        // Durationless items do not distort a time-based course total.
        if (duration > 0) progress.completed += getTopicProgress(item);
      } else {
        progress.total += 1;
        progress.completed += getTopicProgress(item);
      }
      return progress;
    },
    { completed: 0, total: 0, hasTime }
  );
}

function updateProgressBars() {
  const items = [...document.querySelectorAll(".topic-list-item")];
  const overall = calculateProgress(items);
  setProgressBar(".overall-course-progress", "overall-progress-text", overall.completed, overall.total, overall.hasTime);

  const today = calculateProgress(
    items.filter((item) => item.querySelector('input[name="to-do"]').checked),
    overall.hasTime
  );
  setProgressBar(".today-target-course-progress", "today-progress-text", today.completed, today.total, today.hasTime);
}

function saveCourseProgress(courseId) {
  const completed = [];
  const todo = [];
  const lectureProgress = {};

  document.querySelectorAll(".topic-list-item").forEach((item) => {
    const topicId = Number(item.dataset.id);
    if (item.querySelector('input[name="completed"]').checked) completed.push(topicId);
    if (item.querySelector('input[name="to-do"]').checked) todo.push(topicId);
    const slider = item.querySelector('input[name="lecture-progress"]');
    if (slider) lectureProgress[topicId] = Number(slider.value);
  });

  localStorage.setItem(`progress-${courseId}`, JSON.stringify({
    completed,
    todo,
    lectureProgress,
    timestamp: new Date().toISOString(),
  }));
}

function updateChapterStatus(chapter) {
  const allChecked = [...chapter.querySelectorAll('input[name="completed"]')]
    .every((checkbox) => checkbox.checked);
  chapter.classList.toggle("completed", allChecked);
  chapter.querySelector(".chapter-title").classList.toggle("completed", allChecked);
}

function refreshAndSave(courseId, chapter) {
  updateChapterStatus(chapter);
  updateProgressBars();
  saveCourseProgress(courseId);
}

function savedLectureDuration(savedProgress, topicId, duration) {
  const saved = savedProgress.lectureProgress?.[topicId];
  if (Number.isFinite(Number(saved))) return Math.max(0, Math.min(duration, Number(saved)));
  // Legacy records have only a completed list.
  return savedProgress.completed.includes(topicId) ? duration : 0;
}

function setSliderAccessibility(slider, title, value, duration) {
  slider.setAttribute("aria-label", `Progress for ${title}: ${formatDuration(value)} of ${formatDuration(duration)}`);
}

function setSliderProgressVisual(slider, value, duration) {
  slider.style.setProperty("--progress-percent", `${(value / duration) * 100}%`);
}

function renderCourse(data, savedProgress, courseId) {
  const list = document.getElementById("course-list");
  list.innerHTML = "";
  const isTimedCourse = data.some((chapter) => chapter.time_duration > 0);

  data.forEach((chapter) => {
    const chapterItem = document.createElement("li");
    chapterItem.className = "course-chapter";
    const heading = document.createElement("p");
    heading.className = "course-chapter-heading";
    heading.innerHTML = `<span class="chapter-title">${chapter.object_index}. ${chapter.title}<span class="chapter-tick">✔️</span></span>${isTimedCourse ? `<span>${formatDuration(chapter.time_duration)}</span>` : ""}`;

    const topicsList = document.createElement("ul");
    topicsList.className = "chapter-topics collapsed";
    chapter.topics.forEach((topic) => {
      const topicItem = document.createElement("li");
      const duration = topic.time_duration || 0;
      topicItem.className = "topic-list-item";
      topicItem.dataset.id = topic.id;
      topicItem.dataset.duration = duration;

      const completed = document.createElement("input");
      completed.type = "checkbox";
      completed.name = "completed";
      const name = document.createElement("span");
      name.className = "topic-name";
      name.textContent = `${topic.object_index}. ${topic.title}`;
      topicItem.append(completed, name);

      if (duration > 0) {
        const value = savedLectureDuration(savedProgress, topic.id, duration);
        completed.checked = value === duration;
        const current = document.createElement("span");
        current.className = "topic-current-progress";
        current.textContent = formatDuration(value);
        const slider = document.createElement("input");
        slider.type = "range";
        slider.name = "lecture-progress";
        slider.min = "0";
        slider.max = String(duration);
        slider.step = "1";
        slider.value = String(value);
        setSliderAccessibility(slider, topic.title, value, duration);
        setSliderProgressVisual(slider, value, duration);
        const total = document.createElement("span");
        total.className = "topic-duration";
        total.textContent = formatDuration(duration);

        slider.addEventListener("input", () => {
          const nextValue = Number(slider.value);
          current.textContent = formatDuration(nextValue);
          setSliderAccessibility(slider, topic.title, nextValue, duration);
          setSliderProgressVisual(slider, nextValue, duration);
          completed.checked = nextValue === duration;
          refreshAndSave(courseId, chapterItem);
        });
        completed.addEventListener("change", () => {
          const nextValue = completed.checked ? duration : 0;
          slider.value = String(nextValue);
          current.textContent = formatDuration(nextValue);
          setSliderAccessibility(slider, topic.title, nextValue, duration);
          setSliderProgressVisual(slider, nextValue, duration);
          refreshAndSave(courseId, chapterItem);
        });
        topicItem.append(current, slider, total);
      } else {
        completed.checked = savedProgress.completed.includes(topic.id);
        const durationPlaceholder = document.createElement("span");
        durationPlaceholder.className = "topic-duration";
        topicItem.appendChild(durationPlaceholder);
        completed.addEventListener("change", () => refreshAndSave(courseId, chapterItem));
      }

      const todo = document.createElement("input");
      todo.type = "checkbox";
      todo.name = "to-do";
      todo.checked = savedProgress.todo.includes(topic.id);
      todo.addEventListener("change", () => refreshAndSave(courseId, chapterItem));
      topicItem.appendChild(todo);
      topicsList.appendChild(topicItem);
    });

    heading.addEventListener("click", () => {
      if (topicsList.classList.contains("expanded")) {
        topicsList.style.height = `${topicsList.scrollHeight}px`;
        requestAnimationFrame(() => { topicsList.style.height = "0px"; });
        topicsList.classList.remove("expanded");
      } else {
        topicsList.style.height = "auto";
        const height = `${topicsList.scrollHeight}px`;
        topicsList.style.height = "0px";
        topicsList.classList.add("expanded");
        requestAnimationFrame(() => { topicsList.style.height = height; });
      }
    });
    topicsList.addEventListener("transitionend", () => {
      if (topicsList.classList.contains("expanded")) topicsList.style.height = "auto";
    });

    chapterItem.append(heading, topicsList);
    list.appendChild(chapterItem);
    updateChapterStatus(chapterItem);
  });
}

function groupLecturesByChapters(data) {
  const chapters = [];
  let currentChapter;
  data.forEach((sourceItem) => {
    if (sourceItem._class === "chapter") {
      currentChapter = { ...sourceItem, time_duration: 0, topics: [] };
      chapters.push(currentChapter);
      return;
    }
    const duration = sourceItem.asset?.time_estimation || 0;
    currentChapter.time_duration += duration;
    const { asset, ...topic } = { ...sourceItem, time_duration: duration };
    currentChapter.topics.push(topic);
  });
  return chapters;
}

document.addEventListener("DOMContentLoaded", async () => {
  const courseId = new URLSearchParams(window.location.search).get("course");
  if (!courseId || !courses[courseId]) return alert("Invalid course selected.");
  document.getElementById("course-title").textContent = courses[courseId].name;
  try {
    const response = await fetch(courses[courseId].dataUrl);
    const rawData = await response.json();
    const rawProgress = localStorage.getItem(`progress-${courseId}`);
    let savedProgress = { completed: [], todo: [], lectureProgress: {} };
    if (rawProgress) {
      try {
        const parsed = JSON.parse(rawProgress);
        savedProgress = {
          completed: Array.isArray(parsed.completed) ? parsed.completed : [],
          todo: Array.isArray(parsed.todo) ? parsed.todo : [],
          lectureProgress: parsed.lectureProgress && typeof parsed.lectureProgress === "object" ? parsed.lectureProgress : {},
        };
      } catch (error) {
        console.warn("Ignoring invalid saved course progress.", error);
      }
    }
    renderCourse(groupLecturesByChapters(rawData.results), savedProgress, courseId);
    updateProgressBars();
  } catch (error) {
    alert("Failed to load course content.");
    console.error(error);
  }
});

document.getElementById("reset-today-target").addEventListener("click", () => {
  document.querySelectorAll('input[name="to-do"]').forEach((checkbox) => { checkbox.checked = false; });
  updateProgressBars();
  saveCourseProgress(new URLSearchParams(window.location.search).get("course"));
});
