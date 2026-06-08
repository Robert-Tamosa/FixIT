export default function BookServiceButton() {
  const handleBookService = () => {
    // TODO: navigate to booking page or open booking modal
    console.log("Owner clicked Book Service");
  };

  return (
    <button
      onClick={handleBookService}
      className="w-full mb-5 bg-amber-500 hover:bg-amber-600 text-black font-semibold
        py-4 rounded-xl shadow-md transition-colors active:scale-[0.98]">
      Book a Service
    </button>
  );
}