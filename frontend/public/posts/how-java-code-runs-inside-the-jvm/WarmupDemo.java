public class WarmupDemo {
    static long sumSquares(int limit) {
        long total = 0;
        for (int i = 0; i < limit; i++) {
            total += (long) i * i;
        }
        return total;
    }

    public static void main(String[] args) {
        long checksum = 0;
        for (int run = 0; run < 20_000; run++) {
            checksum += sumSquares(1_000);
        }
        System.out.println("Checksum = " + checksum);
    }
}
