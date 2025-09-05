import React, { useEffect, useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  ResponsiveContainer,
} from "recharts";
import { db } from "../../../Backend/firebase";
import { ref, onValue } from "firebase/database";

const COLORS = [
  "#8B0000",
  "#FFA8A2",
  "#C12923",
  "#FF69B4",
  "#FFB6C1",
  "#FF8C8C",
  "#F4A9A8",
];

interface DepartmentData {
  name: string;
  value: number;
  percentage?: number;
}

const DEFAULT_COUNT = 5;

const AuthorPopulationChart: React.FC = () => {
  const [deptPie, setDeptPie] = useState<DepartmentData[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_COUNT);

  useEffect(() => {
    const usersRef = ref(db, "users");

    const unsub = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        const deptCount: Record<string, number> = {};
        Object.entries(data).forEach(([_, user]: [string, any]) => {
          const department = user?.department?.trim?.();
          if (department) {
            deptCount[department] = (deptCount[department] || 0) + 1;
          }
        });

        const totalCount = Object.values(deptCount).reduce(
          (sum, count) => sum + count,
          0
        );

        const deptData: DepartmentData[] = Object.entries(deptCount).map(
          ([name, value]) => ({
            name,
            value,
            percentage: totalCount > 0 ? (value / totalCount) * 100 : 0,
          })
        );

        // ✅ Sort highest → lowest
        deptData.sort((a, b) => b.value - a.value);

        setDeptPie(deptData);
        setVisibleCount(DEFAULT_COUNT); // reset to 5 on data change
        setSelectedDept(null); // reset filter if data changed
      } else {
        setDeptPie([]);
        setVisibleCount(DEFAULT_COUNT);
        setSelectedDept(null);
      }
    });

    return () => unsub();
  }, []);

  // Only show the top N in both the list and the pie
  const visibleDepartments = useMemo(
    () => deptPie.slice(0, Math.min(visibleCount, deptPie.length)),
    [deptPie, visibleCount]
  );

  const canSeeMore = visibleCount < deptPie.length;
  const canShowLess = visibleCount > DEFAULT_COUNT;

  const handleSeeMore = () => {
    setVisibleCount((prev) => Math.min(prev + 5, deptPie.length));
  };

  const handleShowLess = () => {
    setVisibleCount(DEFAULT_COUNT);
    // If the selected dept is no longer in the visible list, clear it
    setSelectedDept((curr) =>
      visibleDepartments.find((d) => d.name === curr) ? curr : null
    );
  };

  const handleCardClick = (deptName: string) => {
    setSelectedDept((curr) => (curr === deptName ? null : deptName));
  };

  const renderCustomLabel = (entry: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, name, percentage } =
      entry;

    if (selectedDept && selectedDept !== name) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const shortName = name.length > 12 ? `${name.substring(0, 12)}...` : name;

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
        className="drop-shadow-sm"
      >
        <tspan x={x} dy="-8">
          {shortName}
        </tspan>
        <tspan x={x} dy="16">
          {(percentage ?? 0).toFixed(1)}%
        </tspan>
      </text>
    );
  };

  return (
    <div className="bg-gradient-to-br from-white to-purple-50 p-4 sm:p-6 rounded-xl shadow-lg border border-purple-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-700 flex items-center gap-2">
          <div className="w-1 h-6 bg-red-900 rounded-full"></div>
          Author Population per Department
        </h3>
        {selectedDept && (
          <button
            onClick={() => setSelectedDept(null)}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Show All
          </button>
        )}
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-6 lg:gap-8">
        {/* Pie Chart (only visible departments) */}
        <div className="w-full xl:w-1/2 min-h-[300px] sm:min-h-[350px] lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <Pie
                data={visibleDepartments} // 👈 only top N
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                innerRadius="30%"
                label={renderCustomLabel}
                labelLine={false}
                strokeWidth={2}
                stroke="#ffffff"
              >
                {visibleDepartments.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={
                      selectedDept && selectedDept !== entry.name ? 0.3 : 1
                    }
                    style={{
                      filter:
                        selectedDept && selectedDept !== entry.name
                          ? "grayscale(50%)"
                          : "none",
                      transition: "all 0.3s ease",
                    }}
                  />
                ))}
              </Pie>
              <PieTooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  fontSize: "14px",
                }}
                formatter={(value: number, name: string) => [
                  `${value} person${value === 1 ? "" : "s"}`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / List (same top N) */}
        <div className="flex-1 w-full min-w-0">
          <h4 className="text-sm font-semibold text-gray-600 mb-3">
            Departments ({visibleDepartments.length}/{deptPie.length})
          </h4>

          <div className="space-y-2">
            {visibleDepartments.map((dept, i) => (
              <div
                key={dept.name}
                className={`flex items-center justify-between p-3 bg-white rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedDept === dept.name
                    ? "border-purple-300 shadow-md bg-purple-50"
                    : "border-gray-100 hover:shadow-sm hover:border-gray-200"
                }`}
                onClick={() => handleCardClick(dept.name)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                    style={{
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-gray-700 font-medium text-sm sm:text-base truncate block">
                      {dept.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {(dept.percentage ?? 0).toFixed(1)}% of total
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-gray-900 font-bold text-sm sm:text-base">
                      {dept.value}
                    </span>
                    <span className="text-gray-500 text-xs ml-1">
                      {dept.value === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      selectedDept === dept.name ? "bg-red-600" : "bg-gray-300"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {deptPie.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No department data available</p>
            </div>
          )}

          {(canSeeMore || canShowLess) && (
            <div className="mt-4 flex gap-2">
              {canShowLess && (
                <button
                  onClick={handleShowLess}
                  className="flex-1 text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  Show less
                </button>
              )}
              {canSeeMore && (
                <button
                  onClick={handleSeeMore}
                  className="flex-1 text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  See more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorPopulationChart;
