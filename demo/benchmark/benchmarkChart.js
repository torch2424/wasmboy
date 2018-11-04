import ChartJsPluginDownsample from 'chartjs-plugin-downsample';

export const getChartConfig = (title, xAxisTitle, yAxisTitle, isHigherBetter, threshold, cycleNumberLabels, wasmData, tsData) => {
  return {
    type: 'line',
    data: {
      labels: cycleNumberLabels,
      datasets: [
        {
          label: 'AssemblyScript (Web Assembly)',
          backgroundColor: '#6447f4',
          borderColor: '#6447f4',
          fill: false,
          data: wasmData
        },
        {
          label: 'Javascript (TypeScript)',
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
        position: 'nearest',
        mode: 'index',
        intersect: false,
        callbacks: {
          title: () => null,
          footer: (tooltipItems, data) => {
            let fastestDifference = 0;

            // Get the label of the fastest dataset,
            const getBetterObject = () => {
              let tooltipCompare;
              if (isHigherBetter) {
                tooltipCompare = tooltipItems[0].yLabel > tooltipItems[1].yLabel;
              } else {
                tooltipCompare = tooltipItems[0].yLabel < tooltipItems[1].yLabel;
              }

              if (tooltipCompare) {
                fastestDifference = tooltipItems[0].yLabel - tooltipItems[1].yLabel;
                return tooltipItems[0];
              } else {
                fastestDifference = tooltipItems[1].yLabel - tooltipItems[0].yLabel;
                return tooltipItems[1];
              }
            };

            const fastestItem = getBetterObject();
            const fastestDataset = data.datasets[fastestItem.datasetIndex];

            return `Best: ${fastestDataset.label} ` + (isHigherBetter ? `(+${fastestDifference})` : `(${fastestDifference})`);
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
              suggestedMin: 0,
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
            },
            ticks: {
              suggestedMin: 0
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
