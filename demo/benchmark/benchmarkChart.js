import ChartJsPluginDownsample from 'chartjs-plugin-downsample';

export const getChartConfig = (title, xAxisTitle, yAxisTitle, isHigherBetter, threshold, cycleNumberLabels, WasmBoyCoreObjectsWithData) => {
  const datasets = [];
  WasmBoyCoreObjectsWithData.forEach(coreObjectWithData => {
    datasets.push({
      label: `${coreObjectWithData.label} (${coreObjectWithData.subLabel})`,
      backgroundColor: coreObjectWithData.color,
      borderColor: coreObjectWithData.color,
      fill: false,
      data: coreObjectWithData.data
    });
  });

  return {
    type: 'line',
    data: {
      labels: cycleNumberLabels,
      datasets
    },
    plugins: [ChartJsPluginDownsample],
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
                if (index % 10 === 0 || index === WasmBoyCoreObjectsWithData[0].data.length) {
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
