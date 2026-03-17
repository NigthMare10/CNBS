export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          height: 240,
          borderRadius: 32,
          background: "linear-gradient(90deg, rgba(226,232,240,0.9) 25%, rgba(241,245,249,0.9) 50%, rgba(226,232,240,0.9) 75%)",
          backgroundSize: "200% 100%",
          animation: "cnbs-skeleton 1.4s ease-in-out infinite"
        }}
      />
      <div className="page-grid-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: 156,
              borderRadius: 24,
              background: "linear-gradient(90deg, rgba(226,232,240,0.9) 25%, rgba(241,245,249,0.9) 50%, rgba(226,232,240,0.9) 75%)",
              backgroundSize: "200% 100%",
              animation: "cnbs-skeleton 1.4s ease-in-out infinite"
            }}
          />
        ))}
      </div>
    </div>
  );
}
