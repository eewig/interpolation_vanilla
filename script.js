if (window.dayjs) {
  if (window.dayjs_plugin_isSameOrAfter) dayjs.extend(window.dayjs_plugin_isSameOrAfter);
  if (window.dayjs_plugin_isSameOrBefore) dayjs.extend(window.dayjs_plugin_isSameOrBefore);
  if (window.dayjs_plugin_duration) dayjs.extend(window.dayjs_plugin_duration);
  if (window.dayjs_plugin_utc) dayjs.extend(window.dayjs_plugin_utc);
}

const STORAGE_KEY = 'interpolation-state';

let spInput;
let spOutput;
let datetimeTZ = '';

const stepInput = document.getElementById('step-value');
const stepDataTypeInput = document.getElementById('x-data-type');
const yPrecisionInput = document.getElementById('y-min');



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
    step: stepInput.value,
    stepDataType: stepDataTypeInput.value,
    yPrecision: yPrecisionInput.value
  }));
}

const savedState = loadSavedState();
stepInput.value = savedState.step || '';
stepDataTypeInput.value = savedState.stepDataType || 'n';
yPrecisionInput.value = savedState.yPrecision || '';

// Create spreadsheets with the last saved data, when available.
spInput = jspreadsheet(document.getElementById('sp-input'), {
    columnResize: true,
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
        },
    }]
});
spOutput = jspreadsheet(document.getElementById('sp-output'), {
    columnResize: true,
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
        beginAtZero: false,
        title: {
          display: true,
          text: 'Y'
        }
      }
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          drag: {
            enabled: true,
          },
          mode: 'y',
        },
        pan: {
          enabled: true,
        },
      }
    },
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
  
  checkDateTimeIsUTC(xDataStr);

  const xData = deserializeXColumn(xDataStr);
  const yData = yDataStr.map(parseFloat);

  validateXColumn(xData, dataGrid.getHeader(0));
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

function deserializeXColumn(axisColumn) {
  if (stepDataTypeInput.value === 'n') {
    return axisColumn.map(parseFloat);
  }
  return axisColumn.map(x => dayjs(x).valueOf());
}

function serializeXColumn(axisColumn) {
  if (stepDataTypeInput.value === 'n') {
    return axisColumn.map(x => x.toString());
  }

  let dayjsBaseSerializerFunc = (x) => dayjs(x.toNumber());
  if (datetimeTZ) {
    dayjsSerializerFunction = (x) => dayjsBaseSerializerFunc(x).tz(datetimeTZ);
  } else {
    dayjsSerializerFunction = (x) => dayjsBaseSerializerFunc(x).local();
  }
  return axisColumn.map(x => dayjsSerializerFunction(x).format());
}

function validateXColumn(axisColumn, columnTitle) {
  if (stepDataTypeInput.value === 'n') {
    return validateColumnNumberData(axisColumn, columnTitle);
  }

  if (axisColumn.some(x => !dayjs(x).isValid())) {
    alert(`Invalid data provided for column "${columnTitle}". Please ensure all values are valid dates.`);
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

  let result = y1.plus(numerator.div(denominator));

  if (yPrecisionInput.value) {
    const precision = Number(yPrecisionInput.value);
    if (!isNaN(precision) && precision) {
      result = result.round(precision);
    }
  }

  return result;
}

function getInterpolatedData(data, step) {
  const stepBig = Big(step);

  const dataPointsArray = data.map(pt => ({ x: Big(pt.x), y: Big(pt.y) }));

  const newData = [];
  let currentX = dataPointsArray[0].x;
  let currentSourceArrayIndex = 0;

  // if (currentX.mod(stepBig) !== 0) {
  //   currentX = currentX.plus(stepBig).minus(currentX.mod(stepBig));
  // } else {
  //   currentX = currentX.plus(stepBig);
  // }


  while (valueLte(currentX, dataPointsArray.at(-1).x)) {
    if (valueEq(currentX, dataPointsArray[currentSourceArrayIndex].x)) {
      newData.push(dataPointsArray[currentSourceArrayIndex]);
      currentX = incrementValueWithStep(currentX);
      continue;
    }
    
    const p1 = dataPointsArray[currentSourceArrayIndex];
    const p2 = dataPointsArray[currentSourceArrayIndex + 1];
    newData.push({ x: currentX, y: linearInterpolation(p1, p2, currentX) });

    currentX = incrementValueWithStep(currentX);
    while(
      dataPointsArray[currentSourceArrayIndex + 1] 
      && valueGte(currentX, dataPointsArray[currentSourceArrayIndex + 1].x)
    ) {
      currentSourceArrayIndex++;
    }
    
  }

  return newData;
}

function setDataPointsArrayToDataGrid(dataGrid, dataArray) {
  const xData = serializeXColumn(dataArray.map(i => i.x));
  const yData = dataArray.map(i => i.y.toString());

  dataGrid.setColumnData(0, xData);
  dataGrid.setColumnData(1, yData);
}

// Chart
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

  const yValues = dataPointsArray
  .map(p => Number(p.y))
  .filter(value => Number.isFinite(value));
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const padding = maxY === minY ? 1 : (maxY - minY) * 0.1;

  chart.options.scales.y = {
    ...chart.options.scales.y,
    min: minY - padding,
    max: maxY + padding,
  };

  chart.update();
}

function resetChartZoom() {
  chart.resetZoom();
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
    newData.push({ x: decrementValue(data[i].x, minX, stepDataTypeInput.value), y: data[i].y });
  }

  return newData;
}

function incrementValueWithStep(value) {
  return incrementValue(value, stepInput.value, stepDataTypeInput.value);
}

function incrementValue(value, addend, dataType) {
  if (dataType !== 'n') {
    addend = dayjs.duration(addend, dataType).asMilliseconds();
  }
  return Big(value).plus(Big(addend));
}

function decrementValueWithStep(value) {
  return decrementValue(value, stepInput.value, stepDataTypeInput.value);
}

function decrementValue(value, subtrahend, dataType) {
    if (dataType !== 'n') {
    subtrahend = dayjs.duration(subtrahend, dataType).asMilliseconds();
  }
  return Big(value).minus(Big(subtrahend));
}

function valueGte(value, compareTo) {
  return Big(value).gte(Big(compareTo));
}

function valueLte(value, compareTo) {
  return Big(value).lte(Big(compareTo));

}

function valueEq(value, compareTo) {
  return Big(value).eq(Big(compareTo));
}

function checkDateTimeIsUTC(axisColumn) {
  if (dayjs(axisColumn[0]).isUTC()) {
    isDatetimeUTC = true;
  }
}

function setDateTimeTZ(axisColumn) {
  if (axisColumn[0]) {
    datetimeTZ = daysjs.tz();
  }
}
