"use strict";

const state = {
  movies: [],
  query: "",
  sortBy: "rating-desc"
};

const elements = {
  grid: document.querySelector("#movieGrid"),
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortSelect"),
  reload: document.querySelector("#reloadButton"),
  empty: document.querySelector("#emptyState"),
  error: document.querySelector("#errorState"),
  errorMessage: document.querySelector("#errorMessage"),
  resultMessage: document.querySelector("#resultMessage"),
  movieCount: document.querySelector("#movieCount"),
  averageRating: document.querySelector("#averageRating"),
  latestYear: document.querySelector("#latestYear"),
  loadedAt: document.querySelector("#loadedAt")
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(field.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  return rows;
}

function rowsToMovies(rows) {
  if (rows.length < 2) throw new Error("CSV 中没有可展示的电影数据。 ");

  const headers = rows[0];
  const expected = ["电影名称", "导演", "上映年份", "类型", "评分"];
  const missing = expected.filter(name => !headers.includes(name));
  if (missing.length) throw new Error(`CSV 缺少字段：${missing.join("、")}`);

  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const year = Number(record["上映年份"]);
    const rating = Number(record["评分"]);

    if (!record["电影名称"] || !record["导演"] || !Number.isFinite(year) || !Number.isFinite(rating)) {
      throw new Error(`CSV 第 ${index + 2} 行数据格式不正确。`);
    }

    return {
      name: record["电影名称"],
      director: record["导演"],
      year,
      genres: record["类型"].split(/[\/、|]/).map(item => item.trim()).filter(Boolean),
      rating
    };
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getVisibleMovies() {
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = state.movies.filter(movie => {
    const text = [movie.name, movie.director, ...movie.genres].join(" ").toLocaleLowerCase("zh-CN");
    return text.includes(query);
  });

  const sorters = {
    "rating-desc": (a, b) => b.rating - a.rating || b.year - a.year,
    "rating-asc": (a, b) => a.rating - b.rating || a.year - b.year,
    "year-desc": (a, b) => b.year - a.year || b.rating - a.rating,
    "year-asc": (a, b) => a.year - b.year || b.rating - a.rating,
    "name-asc": (a, b) => a.name.localeCompare(b.name, "zh-CN")
  };

  return [...filtered].sort(sorters[state.sortBy]);
}

function render() {
  const visible = getVisibleMovies();
  elements.grid.innerHTML = visible.map(movie => `
    <article class="movie-card">
      <div class="card-top">
        <span class="year">${movie.year}</span>
        <span class="rating" aria-label="评分 ${movie.rating.toFixed(1)}">★ ${movie.rating.toFixed(1)}</span>
      </div>
      <h3>${escapeHtml(movie.name)}</h3>
      <p class="director">导演 · ${escapeHtml(movie.director)}</p>
      <div class="genre-list">
        ${movie.genres.map(genre => `<span>${escapeHtml(genre)}</span>`).join("")}
      </div>
    </article>
  `).join("");

  elements.grid.hidden = visible.length === 0;
  elements.empty.hidden = visible.length !== 0;
  elements.resultMessage.textContent = state.query
    ? `找到 ${visible.length} / ${state.movies.length} 部电影`
    : `共展示 ${visible.length} 部电影`;
}

function updateStats() {
  const count = state.movies.length;
  const average = count ? state.movies.reduce((sum, movie) => sum + movie.rating, 0) / count : 0;
  const latest = count ? Math.max(...state.movies.map(movie => movie.year)) : "--";

  elements.movieCount.textContent = String(count).padStart(2, "0");
  elements.averageRating.textContent = average.toFixed(1);
  elements.latestYear.textContent = latest;
}

async function loadMovies() {
  elements.reload.disabled = true;
  elements.reload.innerHTML = '<span aria-hidden="true">↻</span> 正在加载';
  elements.grid.setAttribute("aria-busy", "true");
  elements.error.hidden = true;
  elements.resultMessage.textContent = "正在读取最新 CSV…";

  try {
    const response = await fetch(`movies.csv?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error(`服务器返回 HTTP ${response.status}`);

    const text = await response.text();
    state.movies = rowsToMovies(parseCsv(text));
    updateStats();
    render();
    elements.loadedAt.textContent = new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "medium"
    }).format(new Date());
  } catch (error) {
    elements.grid.innerHTML = "";
    elements.grid.hidden = true;
    elements.empty.hidden = true;
    elements.error.hidden = false;
    elements.errorMessage.textContent = error.message;
    elements.resultMessage.textContent = "加载失败";
  } finally {
    elements.grid.setAttribute("aria-busy", "false");
    elements.reload.disabled = false;
    elements.reload.innerHTML = '<span aria-hidden="true">↻</span> 重新加载 CSV';
  }
}

elements.search.addEventListener("input", event => {
  state.query = event.target.value;
  render();
});

elements.sort.addEventListener("change", event => {
  state.sortBy = event.target.value;
  render();
});

elements.reload.addEventListener("click", loadMovies);
loadMovies();
