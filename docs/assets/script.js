/********************************************
 *  Configuration
 ********************************************/
const CONFIG = {
	owner: "mayank19o7",
	repo: "wallpapers",
	folder: "",
	branch: "main"
};

const githubRepoUrl = `https://github.com/${CONFIG.owner}/${CONFIG.repo}`;
const apiBase = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}`;
const IMAGE_REGEX = /\.(jpg|jpeg|png|webp|gif)$/i;
const $ = id => document.getElementById(id);

$('aboutRepo').textContent = `${CONFIG.owner}/${CONFIG.repo}`;


/********************************************
 *  State
 ********************************************/
let files = [];               // all file objects from GitHub API
let visibleFiles = [];        // filtered subset
let currentIndex = -1;        // for modal navigation


/********************************************
 *  Utilities
 ********************************************/
function el(tag, props = {}, ...children) {
	const e = document.createElement(tag);
	Object.assign(e, props);
	for (const c of children)
		if (typeof c === "string") e.appendChild(document.createTextNode(c));
		else if (c) e.appendChild(c);
	return e;
}

function humanFileSize(bytes) {
	if (bytes === undefined) return "";
	const thresh = 1024;
	if (Math.abs(bytes) < thresh) return bytes + ' B';

	const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let u = -1;

	do {
		bytes /= thresh;
		++u;
	} while (Math.abs(bytes) >= thresh && u < units.length - 1);

	return bytes.toFixed(1) + ' ' + units[u];
}

async function downloadFile(url, filename) {
	try {
		const res = await fetch(url);
		const blob = await res.blob();
		const blobUrl = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = blobUrl;
		a.download = filename;
		document.body.appendChild(a);
		a.click();

		a.remove();
		URL.revokeObjectURL(blobUrl);
	} catch (err) {
		console.error("Download failed:", err);
		window.open(url, "_blank"); // fallback
	}
}

function createImageElement(f, idx) {
	return el("img", {
		id: `img-${idx}`,
		alt: f.name,
		src: f.download_url,
		loading: "lazy",
		decoding: "async"
	});
}


/********************************************
 *  Fetch Repo contents
 ********************************************/
async function fetchRepoContents() {
	try {
		const res = await fetch(apiBase, { cache: "force-cache" });
		if (!res.ok) throw new Error(`API ${res.status}`);
		return await res.json();
	} catch (err) {
		console.warn("GitHub API failed:", err);
		return [];
	}
}


/********************************************
 *  Gallery Rendering
 ********************************************/
const galleryEl = $('gallery');
const loadingWrap = $('loadingWrap');
const pageLoader = $('pageLoader');
const emptyState = $('emptyState');
const featuredHero = $('hero');
const featureMeta = $('featureMeta');
const featureName = $('featureName');
const featureInfo = $('featureInfo');
const featuredLoader = $('featuredLoader');

function clearGallery() {
	galleryEl.innerHTML = '';
}

function renderGallery(list) {
	clearGallery();

	if (!list || list.length === 0) {
		emptyState.style.display = '';
		pageLoader.style.display = 'none';
		return;
	}

	emptyState.style.display = 'none';
	pageLoader.style.display = 'none';

	list.forEach((f, idx) => {
		const card = el('div', { className: 'item', role: 'button', tabIndex: 0 });
		const img = createImageElement(f, idx);
		const label = el('div', { className: 'label' }, f.name);

		card.appendChild(img);
		card.appendChild(label);

		card.onclick = () => openModalByFile(f);
		card.onkeydown = (e) => { if (e.key === 'Enter') openModalByFile(f); };

		galleryEl.appendChild(card);
	});
}


/********************************************
 *  Search / Filter
 ********************************************/
const searchInput = $('searchInput');
let searchTimer = null;

searchInput.addEventListener('input', (e) => {
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		const q = e.target.value.trim().toLowerCase();
		filterFiles(q);
	}, 200);
});

function filterFiles(q) {
	const query = q.toLowerCase().trim();

	// Full reset of visibility
	if (!query) {
		visibleFiles = files.slice();
		renderGallery(visibleFiles);
		pickFeaturedRandom();     // <-- restore featured correctly
		return;
	}

	// Filtered list
	visibleFiles = files.filter(f => f.name.toLowerCase().includes(query));
	renderGallery(visibleFiles);

	if (visibleFiles.length === 0) {
		// Clear featured area when no results
		showNoFeaturedMessage();
		return;
	}

	// If featured is not part of visible set → refresh it
	if (!visibleFiles.includes(files[currentIndex])) {
		pickFeaturedRandom();
	}
	else {
		// Keep current featured if valid
		showFeatured(files[currentIndex]);
	}
}


/********************************************
 *  Featured Banner
 ********************************************/
function showNoFeaturedMessage() {
	featuredHero.innerHTML = '';                      // remove old image
	featureMeta.setAttribute('aria-hidden', 'false'); // show meta box
	featureName.textContent = "No image found";       // title replacement
	featureInfo.textContent = "Try a different search."; // message

	// Disable buttons
	$('viewBtn').disabled = true;
	$('downloadBtn').disabled = true;
}

function showFeatured(f) {
	featuredLoader.style.display = 'none';
	featureMeta.setAttribute('aria-hidden', 'false');

	$('viewBtn').disabled = false;
	$('downloadBtn').disabled = false;

	const heroImg = el('img', { src: f.download_url, alt: f.name });

	// Clear then append
	featuredHero.innerHTML = '';
	featuredHero.appendChild(heroImg);
	featureName.textContent = f.name.split('.')[0];
	featureInfo.textContent = `${humanFileSize(f.size || 0)} • ${f.name.split('.').pop().toUpperCase()}`;

	$('viewBtn').onclick = () => openModalByFile(f);
	$('downloadBtn').onclick = () => downloadFile(f.download_url, f.name);
}

function pickFeaturedRandom() {
	if (!visibleFiles || visibleFiles.length === 0) {
		featuredHero.innerHTML = '';
		featureMeta.setAttribute('aria-hidden', 'true');
		featuredLoader.style.display = 'none';
		return;
	}

	featuredLoader.style.display = 'none';

	let n;
	do {
		n = Math.floor(Math.random() * visibleFiles.length);
	} while (files.indexOf(visibleFiles[n]) === currentIndex && visibleFiles.length > 1);

	currentIndex = files.indexOf(visibleFiles[n]);
	showFeatured(visibleFiles[n]);
}


/********************************************
 *  Modal View
 ********************************************/
const modalBg = $('modal');
const modalImg = $('modalImg');
const modalName = $('modalName');
const modalMeta = $('modalMeta');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const downloadBtnModal = $('downloadBtnModal');
const openOriginal = $('openOriginal');
const closeBtn = $('closeBtn');

prevBtn.addEventListener("click", prevModal);
nextBtn.addEventListener("click", nextModal);
closeBtn.addEventListener("click", closeModal);

function openModalByFile(f) {
	const idx = files.indexOf(f);
	if (idx === -1) return;
	currentIndex = idx;
	openModalAtIndex(idx);
}

function updateModalInfo(f) {
	modalImg.src = f.download_url;
	modalName.textContent = f.name.split('.')[0];
	modalMeta.textContent = `${humanFileSize(f.size || 0)} • ${f.name.split('.').pop().toUpperCase()}`;
}

function openModalAtIndex(idx) {
	const f = files[idx];
	if (!f) return;

	updateModalInfo(f);

	openOriginal.onclick = () => window.open(f.download_url, '_blank');
	downloadBtnModal.onclick = () => downloadFile(f.download_url, f.name);

	modalBg.classList.add('show');
	modalBg.setAttribute('aria-hidden', 'false');
}

function closeModal() {
	modalBg.classList.remove('show');
	modalBg.setAttribute('aria-hidden', 'true');
	modalImg.src = '';
}

function cycleIndex(delta) {
	if (files.length === 0) return;
	currentIndex = (currentIndex + delta + files.length) % files.length;
	openModalAtIndex(currentIndex);
}

function prevModal() {
	cycleIndex(-1);
}

function nextModal() {
	cycleIndex(+1);
}

modalBg.addEventListener('click', (e) => {
	if (e.target === modalBg) closeModal();
});

document.addEventListener('keydown', (e) => {
	if (modalBg.classList.contains('show')) {
		if (e.key === 'Escape') closeModal();
		if (e.key === 'ArrowLeft') prevModal();
		if (e.key === 'ArrowRight') nextModal();
	}
});


/********************************************
 *  Button actions
 ********************************************/
$('shuffleBtn').addEventListener('click', pickFeaturedRandom);
$('viewBtn').addEventListener('click', () => {
	if (currentIndex >= 0 && files[currentIndex]) openModalByFile(files[currentIndex]);
});


/********************************************
 *  About dialog
 ********************************************/
const aboutDlg = $('aboutDlg');
$('aboutClose').addEventListener('click', () => aboutDlg.close());
function aboutDialog() { aboutDlg.showModal(); }


/********************************************
 *  Boot - initialize
 ********************************************/
async function boot() {
	try {
		const data = await fetchRepoContents();

		// Accept array result, ensure filtering of images
		files = Array.isArray(data)
			? data.filter(f => f.type === 'file' && IMAGE_REGEX.test(f.name))
			: [];

		// Add fallback download_url if missing
		files = files.map(f => {
			if (!f.download_url) {
				f.download_url = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${encodeURIComponent(f.path)}`;
			}
			return f;
		});

		visibleFiles = files.slice();

		// Render gallery & featured (with small delay for UX polish)
		if (files.length === 0) {
			pageLoader.style.display = 'none';
			emptyState.style.display = '';
			featuredLoader.style.display = 'none';
		} else {
			// slightly delay to show loader
			setTimeout(() => {
				renderGallery(visibleFiles);
				pickFeaturedRandom();
			}, 300);
		}
	} catch (err) {
		console.error("Failed to initialize gallery:", err);
		pageLoader.style.display = 'none';
		emptyState.style.display = '';
	}
}

/* run boot */
boot();

/********************************************
 *  Accessiblity / Error Handling
 ********************************************/
document.body.addEventListener('keyup', (e) => {
	if (e.key === 'Tab') document.body.classList.add('show-focus');
});

galleryEl.addEventListener('error', (e) => {
	if (e.target && e.target.tagName === 'IMG') {
		e.target.style.opacity = 0.65;
		e.target.alt = 'Failed to load';
	}
}, true);

