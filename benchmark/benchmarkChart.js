import ChartJsPluginDownsample from 'chartjs-plugin-downsample';

export const getChartConfig = (title, xAxisTitle, yAxisTitle, isHigherBetter, threshold, cycleNumberLabels, wasmData, tsData) => {
  return {
    type: 'line',
    data: {
      labels: cycleNumberLabels,
      datasets: [
        {
          label: 'Wasm',
          backgroundColor: '#6447f4',
          borderColor: '#6447f4',
          fill: false,
          data: wasmData
        },
        {
          label: 'Ts',
          backgroundColor: '#f7a800',
          borderColor: '#f7a800',
          fill: false,
          data: tsData
        }
      ]
    },
    plugins: [ChartJsPluginDownsample],
    options: {
      responsive: true,
      title: {
        display: true,
        text: title
      },
      tooltips: {
        position: 'average',
        mode: 'index',
        intersect: false,
        callbacks: {
          title: () => null,
          footer: (tooltipItems, data) => {
            let fastestDifference = 0;

            // Get the label of the fastest dataset,
            const getBetterObject = () => {
              let firstIndex = 1;
              let secondIndex = 0;
              if (isHigherBetter) {
                firstIndex = 0;
                secondIndex = 1;
              }

              if (tooltipItems[firstIndex].yLabel > tooltipItems[secondIndex].yLabel) {
                fastestDifference = tooltipItems[firstIndex].yLabel - tooltipItems[secondIndex].yLabel;
                return tooltipItems[firstIndex];
              } else {
                fastestDifference = tooltipItems[secondIndex].yLabel - tooltipItems[firstIndex].yLabel;
                return tooltipItems[secondIndex];
              }
            };

            const fastestItem = getBetterObject();
            const fastestDataset = data.datasets[fastestItem.datasetIndex];

            return `Best: ${fastestDataset.label}` + (isHigherBetter ? `(+${fastestDifference})` : `(${fastestDifference})`);
          }
        }
      },
      hover: {
        mode: 'average',
        intersect: true
      },
      scales: {
        xAxes: [
          {
            display: true,
            scaleLabel: {
              display: true,
              labelString: xAxisTitle
            },
            ticks: {
              callback: (dataLabel, index) => {
                if (index % 10 === 0 || index === wasmData.length) {
                  return dataLabel;
                }
                return null;
              }
            }
          }
        ],
        yAxes: [
          {
            display: true,
            scaleLabel: {
              display: true,
              labelString: yAxisTitle
            }
          }
        ]
      },
      downsample: {
        enabled: true,
        threshold: threshold // max number of points to display per dataset
      }
    }
  };
};
