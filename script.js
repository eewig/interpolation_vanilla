
const STORAGE_KEY = 'interpolation-state';
let spInput;
let spOutput;
const stepInput = document.getElementById('step-value');
const stepValue = stepInput.value;
const stepDataType = document.getElementById('x-data-type').value;


function loadSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveState() {
  if (!spInput) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    inputData: spInput[0].getData(),
    step: stepInput.value
  }));
}

const savedState = loadSavedState();
stepInput.value = savedState.step || '';

// Create spreadsheets with the last saved data, when available.
spInput = jspreadsheet(document.getElementById('sp-input'), {
    worksheets: [{
        data: savedState.inputData || [],
        minDimensions: [2,6],
        minSpareRows: 1,
        allowInsertColumn: false,
        allowManualInsertColumn: false,
        columns: [
          { type: 'number', title: 'X' },
          { type: 'number', title: 'Y' },
        ],
        onblur: function() {
          setTimeout(saveState, 0);
        }
    }]
});
spOutput = jspreadsheet(document.getElementById('sp-output'), {
    worksheets: [{
        minDimensions: [2,6],
        minSpareRows: 1,
        allowInsertColumn: false,
        allowManualInsertColumn: false,
        columns: [
          { type: 'number', title: 'X' },
          { type: 'number', title: 'Y' },
        ],
    }],
});
stepInput.addEventListener('blur', saveState);

const ctx = document.getElementById('myChart');
const chartWrapper = document.getElementById('chart-wrapper');
const fullscreenButton = document.getElementById('fullscreen-btn');

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    chartWrapper.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

fullscreenButton.addEventListener('click', toggleFullscreen);

let chart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'Input',
        data: [],
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.2)',
        tension: 0,
        pointRadius: 3
      },
      {
        label: 'Output',
        data: [],
        borderColor: '#198754',
        backgroundColor: 'rgba(25, 135, 84, 0.2)',
        tension: 0,
        pointRadius: 3
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'X'
        },
        ticks: {
          stepSize: 1
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Y'
        }
      }
    }
  }
});

function calculate() {
  const inputDataGrid = spInput[0];
  const outputDataGrid = spOutput[0];
  const step = parseFloat(stepInput.value);

  outputDataGrid.setData([]);

  validateStep(step);

  const inputDataPointsArray = getDataPointsArrayFromDataGrid(inputDataGrid);

  if (!inputDataPointsArray) {
    return;
  }

  let interpolatedDataPointsArray = getInterpolatedData(inputDataPointsArray, step);
  
  setDataPointsArrayToDataGrid(outputDataGrid, interpolatedDataPointsArray);
  saveState();
}

function getDataPointsArrayFromDataGrid(dataGrid) {
  const xDataStr = dataGrid.getColumnData(0).filter(i => i !== "");
  const yDataStr = dataGrid.getColumnData(1).filter(i => i !== "");

  validateColumnStringData(xDataStr, dataGrid.getHeader(0));
  validateColumnStringData(yDataStr, dataGrid.getHeader(1));

  if (xDataStr.length !== yDataStr.length) {
    alert("Data is incomplete. Please ensure both columns have the same number of data points.");
    return;
  }

  const xData = xDataStr.map(Number);
  const yData = yDataStr.map(Number);

  if (xData.some(isNaN) || yData.some(isNaN)) {
    alert("Invalid data provided. Please ensure all values are numbers.");
    return;
  }

  validateColumnNumberData(xData, dataGrid.getHeader(0));
  validateColumnNumberData(yData, dataGrid.getHeader(1));

  const dataArray = xData.map((key, i) => ({x: key, y: yData[i]}));

  dataArray.sort((a, b) => a.x - b.x);

  return dataArray;
}

function validateColumnStringData(axisColumn, columnTitle) {
  if (axisColumn.length === 0) {
    alert(`No data provided for column "${columnTitle}"`);
    return;
  }
  return true;
}

function validateColumnNumberData(axisColumn, columnTitle) {
  if (axisColumn.some(isNaN)) {
    alert(`Invalid data provided for column "${columnTitle}". Please ensure all values are numbers.`);
    return;
  }
  if (axisColumn.some(x => x < 0)) {
    alert(`Column "${columnTitle}" contains negative values. This option is not available for now`);
    return;
  }
  return true;
}

function validateStep(step) {
  if (isNaN(step) || step <= 0) {
    alert("Please provide a valid step value greater than 0");
    return;
  }
  return true;
}

function linearInterpolation(p1, p2, xTarget) {
  // formula: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
  // return p1.y + (xTarget - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
  const x1 = Big(p1.x);
  const y1 = Big(p1.y);
  const x2 = Big(p2.x);
  const y2 = Big(p2.y);
  const x = Big(xTarget);

  const numerator = x.minus(x1).times(y2.minus(y1));
  const denominator = x2.minus(x1);

  return y1.plus(numerator.div(denominator));
}

function getInterpolatedData(data, step) {
  const stepBig = Big(step);

  const dataPointsBig = data.map(pt => ({ x: Big(pt.x), y: Big(pt.y) }));

  const startX = dataPointsBig[0].x;
  const newData = [{ x: startX, y: dataPointsBig[0].y }];
  let currentX = startX;
  let currentSourceArrayIndex = 0;

  if (currentX.mod(stepBig) !== 0) {
    currentX = currentX.plus(stepBig).minus(currentX.mod(stepBig));
  } else {
    currentX = currentX.plus(stepBig);
  }

  while (currentX.lte(dataPointsBig.at(-1).x)) {
    if (currentX.eq(dataPointsBig[currentSourceArrayIndex].x)) {
      newData.push(dataPointsBig[currentSourceArrayIndex]);
      currentX = currentX.plus(stepBig);
      continue;
    }

    const p1 = dataPointsBig[currentSourceArrayIndex];
    const p2 = dataPointsBig[currentSourceArrayIndex + 1];
    newData.push({ x: currentX, y: linearInterpolation(p1, p2, currentX) });

    currentX = currentX.plus(stepBig);
    if (currentX.gte(dataPointsBig[currentSourceArrayIndex + 1].x)) {
      currentSourceArrayIndex++;
    }
  }

  return newData;
}

function setDataPointsArrayToDataGrid(dataGrid, dataArray) {
  const xData = dataArray.map(i => i.x.toString());
  const yData = dataArray.map(i => i.y.toString());

  dataGrid.setColumnData(0, xData);
  dataGrid.setColumnData(1, yData);
}

function updateChartData(datasetIndex, dataPointsArray, label) {
  const step = parseFloat(stepInput.value);
  const tickStep = Number.isFinite(step) && step > 0 ? step : 1;

  chart.data.datasets[datasetIndex].label = label;
  chart.data.datasets[datasetIndex].data = dataPointsArray.map(point => ({
    x: Number(point.x),
    y: Number(point.y)
  }));

  chart.options.scales.x.ticks = {
    ...chart.options.scales.x.ticks,
    stepSize: tickStep
  };

  chart.update();
}

function plotInput() {
  const inputDataGrid = spInput[0];
  const inputDataPointsArray = getDataPointsArrayFromDataGrid(inputDataGrid);

  if (!inputDataPointsArray) {
    return;
  }

  updateChartData(0, inputDataPointsArray, 'Input');
}

function plotOutput() {
  const outputDataGrid = spOutput[0];
  const outputDataPointsArray = getDataPointsArrayFromDataGrid(outputDataGrid);

  if (!outputDataPointsArray) {
    return;
  }

  updateChartData(1, outputDataPointsArray, 'Output');
}

function shiftInputDataToZero() {
  const inputDataGrid = spInput[0];
  const inputDataPointsArray = getDataPointsArrayFromDataGrid(inputDataGrid);

  if (!inputDataPointsArray) {
    return;
  }

  const shiftedDataPointsArray = shiftDataToZero(inputDataPointsArray);
  setDataPointsArrayToDataGrid(inputDataGrid, shiftedDataPointsArray);
}

function shiftDataToZero(data) {
  const minX = data[0].x;
  const newData = [];

  for (let i = 0; i < data.length; i++) {
    newData.push({ x: decrementValue(data[i].x, minX, stepDataType), y: data[i].y });
  }

  return newData;
}

function incrementValueWithStep(value) {
  return incrementValue(value, stepValue, stepDataType);
}

function incrementValue(value, addend, dataType) {
  if (dataType === 'n') {
    return Big(value).plus(Big(addend));
  }
  return dayjs(value).add(addend, dataType);
}

function decrementValueWithStep(value) {
  return decrementValue(value, stepValue, stepDataType);
}

function decrementValue(value, subtrahend, dataType) {
  if (dataType === 'n') {
    return Big(value).minus(Big(subtrahend));
  }
  return dayjs(value).subtract(subtrahend, dataType);
}
