/**
 * 简单的异步队列示例
 * 演示 publishInbound 和 consumeInbound 的工作原理
 */

class SimpleQueue<T> {
  private queue: T[] = [];
  private waitingConsumers: Array<(msg: T) => void> = [];

  /**
   * 发送消息（发布者）
   */
  publish(msg: T) {
    this.queue.push(msg);
    console.log(`📤 发布消息: ${msg}, 队列长度: ${this.queue.length}`);

    // 看有没有人在等
    if (this.waitingConsumers.length > 0) {
      const consumer = this.waitingConsumers.shift()!; // 取出第一个等的人
      const nextMsg = this.queue.shift()!; // 取出第一条消息
      consumer(nextMsg); // 唤醒他！
      console.log(`✅ 唤醒等待的消费者, 剩余等待: ${this.waitingConsumers.length}`);
    }
  }

  /**
   * 消费消息（消费者）
   */
  async consume(): Promise<T> {
    // 队列有消息？直接拿
    if (this.queue.length > 0) {
      const msg = this.queue.shift()!;
      console.log(`📥 队列有消息，直接拿: ${msg}`);
      return msg;
    }

    // 没消息？挂个号等
    console.log('⏳ 队列空，开始等待...');
    return new Promise(resolve => {
      this.waitingConsumers.push(resolve); // 把 resolve 存排队本
    });
  }
}

// 测试
async function main() {
  const queue = new SimpleQueue<string>();

  console.log('========== 情况1：先有消息，后来消费者 ==========');
  queue.publish('hello1');
  queue.publish('hello2');
  const msg1 = await queue.consume();
  console.log(`收到消息: ${msg1}\n`);

  console.log('========== 情况2：先有消费者，后有消息（阻塞） ==========');
  console.log('消费者1 开始消费...');
  const consumer1 = queue.consume(); // 不等待，启动消费者1

  console.log('消费者2 开始消费...');
  const consumer2 = queue.consume(); // 不等待，启动消费者2

  console.log('延迟1秒后发送消息...\n');
  setTimeout(() => queue.publish('world1'), 1000);
  setTimeout(() => queue.publish('world2'), 1500);

  const [r1, r2] = await Promise.all([consumer1, consumer2]);
  console.log(`\n消费者1 收到: ${r1}`);
  console.log(`消费者2 收到: ${r2}`);
}

main().catch(console.error);
