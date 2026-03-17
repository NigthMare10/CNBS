export default function Loading() {
  return (
    <div className="admin-page">
      <div
        style={{
          height: 180,
          borderRadius: 28,
          background: "linear-gradient(90deg, rgba(226,232,240,0.9) 25%, rgba(241,245,249,0.9) 50%, rgba(226,232,240,0.9) 75%)",
          backgroundSize: "200% 100%",
          animation: "cnbs-skeleton 1.4s ease-in-out infinite"
        }}
      />
      <div className="admin-grid-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: 220,
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
