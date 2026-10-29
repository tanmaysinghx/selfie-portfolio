public class ExecutionDemo {
    static int multiplier = initializeMultiplier();

    static int initializeMultiplier() {
        System.out.println("1. Class initialization");
        return 2;
    }

    static int add(int left, int right) {
        int sum = left + right;
        return sum;
    }

    public static void main(String[] args) {
        System.out.println("2. Enter main");
        int answer = add(20, 22);
        System.out.println("3. Answer = " + answer);
        System.out.println("4. Scaled = " + answer * multiplier);
    }
}
