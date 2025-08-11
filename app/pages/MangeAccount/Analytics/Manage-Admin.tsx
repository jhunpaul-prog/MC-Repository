import React from 'react';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const NewUserStats = ({ trendPercent }: { trendPercent: number }) => {
  let displayText = '';
  let barColor = 'green';

  // Handle different cases for trendPercent
  if (trendPercent > 0) {
    displayText = `+${trendPercent}%`;
    barColor = 'green'; // Increase: green
  } else if (trendPercent < 0) {
    displayText = `${Math.abs(trendPercent)}%`;
    barColor = 'red'; // Decrease: red
  } else {
    displayText = 'No Change';
    barColor = 'gray'; // No change: gray
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Display the circular progress bar */}
      <div style={{ width: 80, height: 80 }}>
        <CircularProgressbar
          value={Math.abs(trendPercent)} // Use absolute value for display
          text={displayText}
          styles={{
            path: { stroke: barColor },
            text: { fill: barColor, fontSize: '16px' },
          }}
        />
      </div>
      {/* Display the percentage text next to the progress bar */}
      <div className="text-lg font-semibold text-gray-700">
        {displayText}
      </div>
    </div>
  );
};

export default NewUserStats;
