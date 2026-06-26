import ApexCharts from 'apexcharts'

// Palette pulled from _vars.scss so charts stay in the project's stylistics
const C = {
	green: '#169E23',
	blue: '#0081FF',
	yellow: '#FFC107',
	red: '#BC4141',
	grey: '#737F8C',
	border: '#E1E1E1',
	black: '#0F1A24',
	white: '#FFFFFF',
}
const CAT_COLORS = [C.green, C.blue, C.yellow, C.red]

function readConfig(root) {
	const el = root.querySelector('[data-chart-config]')
	if (!el) return {}
	try {
		return JSON.parse(el.textContent)
	} catch {
		return {}
	}
}

// ring / category donut — center stays hollow (filled by an HTML overlay so the
// "Сотрудники / 22" label matches the design exactly)
function donutOptions(cfg) {
	return {
		chart: { type: 'donut', fontFamily: 'inherit', height: cfg.height || 240, animations: { speed: 500 } },
		series: cfg.series || [],
		labels: cfg.labels || [],
		colors: cfg.colors || CAT_COLORS,
		stroke: { width: 3, colors: [C.white] },
		dataLabels: { enabled: false },
		legend: { show: false },
		plotOptions: { pie: { donut: { size: '74%', labels: { show: false } }, expandOnClick: false } },
		states: { hover: { filter: { type: 'darken', value: 0.92 } } },
		tooltip: { enabled: true, y: { formatter: (v) => `${v}%` } },
	}
}

// smooth single-series line with a light grid and percentage y-axis
function lineOptions(cfg) {
	return {
		chart: { type: 'line', fontFamily: 'inherit', height: cfg.height || 230, toolbar: { show: false }, zoom: { enabled: false }, parentHeightOffset: 0 },
		series: [{ name: cfg.name || '', data: cfg.data || [] }],
		colors: cfg.colors || [C.blue],
		stroke: { curve: 'smooth', width: 2.5, lineCap: 'round' },
		markers: { size: 5, colors: [cfg.colors?.[0] || C.blue], strokeColors: C.white, strokeWidth: 2, hover: { size: 6 } },
		dataLabels: { enabled: false },
		grid: { borderColor: C.border, strokeDashArray: 0, padding: { left: 10, right: 10, top: 0 } },
		xaxis: {
			categories: cfg.categories || [],
			axisBorder: { show: false },
			axisTicks: { show: false },
			labels: { style: { colors: C.grey, fontSize: '13px' } },
			tooltip: { enabled: false },
		},
		yaxis: {
			min: cfg.min ?? 50,
			max: cfg.max ?? 80,
			tickAmount: cfg.tickAmount ?? 3,
			labels: { formatter: (v) => `${Math.round(v)}%`, style: { colors: C.grey, fontSize: '13px' } },
		},
		tooltip: { y: { formatter: (v) => `${v}%` } },
	}
}

const BUILDERS = { donut: donutOptions, line: lineOptions }

export default function Chart(root) {
	if (root.__chartBound) return
	const build = BUILDERS[root.dataset.chart]
	if (!build) return
	root.__chartBound = true

	const target = root.querySelector('[data-chart-canvas]') || root
	const chart = new ApexCharts(target, build(readConfig(root)))
	chart.render()

	return () => {
		chart.destroy()
		delete root.__chartBound
	}
}
