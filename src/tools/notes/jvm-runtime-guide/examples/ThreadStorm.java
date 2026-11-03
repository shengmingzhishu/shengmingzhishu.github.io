/**
 * ThreadStorm.java —— 故意制造线程爆炸的演示程序
 * ------------------------------------------------------------
 * 用途：配合 -Xmx / -Xss / -XX:MaxMetaspaceSize 等参数，观察
 *       「线程数 → 内存占用 → OOM 类型」的变化过程。
 *
 * 编译：
 *   javac ThreadStorm.java
 *
 * 运行（本地，64MB 堆 + 512k 线程栈）：
 *   java -Xmx64m -Xms64m -Xss512k -XX:MaxMetaspaceSize=64m -XX:+HeapDumpOnOutOfMemoryError ThreadStorm
 *
 * 期望现象：
 *   1. 线程数持续上涨，RSS 同步上涨（线程栈不在堆内，受 -Xmx 限制不住）
 *   2. 若先撞到 -Xmx 上限 → java.lang.OutOfMemoryError: Java heap space
 *   3. 若先撞到 Metaspace 上限 → java.lang.OutOfMemoryError: Metaspace
 *   4. 线程数失控时可能出现 unable to create new native thread
 *
 * 安全提示：
 *   本程序会快速耗尽本机资源。请务必在容器 / 虚拟机 / CI 沙箱中运行，
 *   不要在宿主机上直接跑。
 */
public class ThreadStorm {

    /** 每个线程持有的业务对象，用来消耗堆内存。 */
    static final class Payload {
        final byte[] buffer = new byte[64 * 1024]; // 64 KB
        final String name;
        Payload(String name) { this.name = name; }
    }

    public static void main(String[] args) throws Exception {
        int maxThreads = args.length > 0 ? Integer.parseInt(args[0]) : 5000;
        long payloadPerThread = args.length > 1 ? Long.parseLong(args[1]) : 1;

        System.out.println("=== ThreadStorm 启动 ===");
        System.out.println("maxHeap   = " + (Runtime.getRuntime().maxMemory() >> 20) + " MB");
        System.out.println("totalHeap = " + (Runtime.getRuntime().totalMemory() >> 20) + " MB");
        System.out.println("freeHeap  = " + (Runtime.getRuntime().freeMemory() >> 20) + " MB");
        System.out.println("availableProcessors = " + Runtime.getRuntime().availableProcessors());
        System.out.println("目标线程数上限 = " + maxThreads);
        System.out.println();

        final java.util.concurrent.atomic.AtomicInteger created =
                new java.util.concurrent.atomic.AtomicInteger();
        final java.util.List<Thread> threads = new java.util.ArrayList<>();
        final java.util.List<Payload> payloads =
                new java.util.concurrent.CopyOnWriteArrayList<>();

        /* 守护线程：定期打印内存快照，让曲线可见 */
        Thread reporter = new Thread(() -> {
            Runtime rt = Runtime.getRuntime();
            while (true) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    return;
                }
                long used = (rt.totalMemory() - rt.freeMemory()) >> 20;
                System.out.printf(
                        "[monitor] threads=%-5d heapUsed=%-6dMB heapMax=%-6dMB metaspace~=%s%n",
                        created.get(), used,
                        (rt.maxMemory() >> 20),
                        usedMetaspace());
            }
        }, "monitor");
        reporter.setDaemon(true);
        reporter.start();

        /* 主循环：每次迭代创建一个新线程，直到达到上限或被 OOM 打断 */
        try {
            for (int i = 0; i < maxThreads; i++) {
                final int id = i;
                Thread t = new Thread(() -> {
                    Payload p = null;
                    try {
                        for (long k = 0; k < payloadPerThread; k++) {
                            p = new Payload("payload-" + id);
                            payloads.add(p);
                        }
                        /* 让线程保持存活，栈空间才真正被占用 */
                        while (true) {
                            Thread.sleep(60_000);
                        }
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }, "worker-" + id);
                t.setDaemon(true);
                t.start();
                threads.add(t);
                created.incrementAndGet();

                if (i % 100 == 0) {
                    System.out.printf("已创建 %d 个线程%n", created.get());
                }
            }
        } catch (Throwable t) {
            /* 这里会捕获到 OutOfMemoryError 等 Throwable */
            System.out.println();
            System.out.println("=== 捕获到异常 ===");
            System.out.println("类型：" + t.getClass().getName());
            System.out.println("信息：" + t.getMessage());
            System.out.println("此时线程数 = " + created.get());
            System.out.println("此时堆使用 = " + ((Runtime.getRuntime().totalMemory()
                    - Runtime.getRuntime().freeMemory()) >> 20) + " MB");
            System.out.println("堆上限 = " + (Runtime.getRuntime().maxMemory() >> 20) + " MB");
            t.printStackTrace();
        }
    }

    /** 粗略读取 Metaspace 使用量（需要 jdk.management / 反射方式，失败返回 unknown）。 */
    static String usedMetaspace() {
        try {
            Class<?> bean = Class.forName("java.lang.management.ManagementFactory");
            Object platform = bean.getMethod("getPlatformMBeanServer").invoke(null);
            Class<?> mbs = Class.forName("javax.management.MBeanServer");
            Object name = Class.forName("java.lang.management.ObjectName")
                    .getConstructor(String.class).newInstance("java.lang:type=MemoryPool,name=Metaspace");
            Object usage = mbs.getMethod("getAttribute", Class.forName("javax.management.ObjectName"), String.class)
                    .invoke(platform, name, "Usage");
            long used = (long) usage.getClass().getMethod("getUsed").invoke(usage);
            return (used >> 20) + "MB";
        } catch (Throwable ignore) {
            return "unknown";
        }
    }
}
