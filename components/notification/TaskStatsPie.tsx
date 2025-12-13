import React from 'react';
import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

interface SliceItem {
  value: number;
  color: string;
}

interface Props {
  chartData: SliceItem[];
}

const TaskStatsPie: React.FC<Props> = ({ chartData }) => {
  const pieData = chartData.map(item => ({
    value: item.value,
    color: item.color,
  }));

  return (
    <View>
      <PieChart
        data={pieData}
        radius={60}
        innerRadius={35}
        donut
      />
    </View>
  );
};

export default TaskStatsPie;
