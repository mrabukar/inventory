import { Card } from "@/components/ui/card";
import { LineArea } from "@/components/charts/line-area";
import { Donut } from "@/components/charts/donut";

interface Props {
  mobiles: number;
  accessories: number;
}

export function ManagerChartsSection({ mobiles, accessories }: Props) {
  const total = mobiles + accessories;

  return (
    <div className="grid-2 mb-16">
      <Card title="Sales Trend (30 days)" pad>
        <LineArea
          values={[820, 1100, 640, 1340, 980, 1620, 1210]}
          labels={["W1", "", "W2", "", "W3", "", "W4"]}
          height={200}
          color="var(--brand-indigo)"
        />
      </Card>
      <Card title="Stock by Category" pad>
        <Donut
          data={[
            { label: "Mobiles", value: mobiles || 1, color: "var(--brand-indigo)" },
            { label: "Accessories", value: accessories || 1, color: "var(--brand-teal)" },
          ]}
          centerLabel="units"
          centerValue={total}
        />
      </Card>
    </div>
  );
}
