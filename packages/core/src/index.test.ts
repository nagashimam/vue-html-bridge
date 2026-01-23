import { describe, expect, it } from "vitest";
import { bridge } from "./index";

describe("Script Analysis", () => {
  it("Union Types (Props)", () => {
    const input = `<template>
  <div :aria-hidden="hidden">test</div>
</template>
<script lang="ts" setup>
const props = defineProps<{ hidden: 'true' | 'false' }>()
</script>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: '<div aria-hidden="true">test</div>',
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="40" aria-hidden="true" data-aria-hidden-start-line="2" data-aria-hidden-start-column="8" data-aria-hidden-end-line="2" data-aria-hidden-end-column="29">test</div>',
    });
    expect(output).toContainEqual({
      plain: '<div aria-hidden="false">test</div>',
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="40" aria-hidden="false" data-aria-hidden-start-line="2" data-aria-hidden-start-column="8" data-aria-hidden-end-line="2" data-aria-hidden-end-column="29">test</div>',
    });
  });

  it("Booleans (Props)", () => {
    const input = `<template>
  <button :disabled="isDisabled">Click</button>
</template>
<script lang="ts" setup>
defineProps<{ isDisabled: boolean }>()
</script>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: '<button disabled="true">Click</button>',
      annotated:
        '<button data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="48" disabled="true" data-disabled-start-line="2" data-disabled-start-column="11" data-disabled-end-line="2" data-disabled-end-column="33">Click</button>',
    });
    expect(output).toContainEqual({
      plain: '<button disabled="false">Click</button>',
      annotated:
        '<button data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="48" disabled="false" data-disabled-start-line="2" data-disabled-start-column="11" data-disabled-end-line="2" data-disabled-end-column="33">Click</button>',
    });
  });

  it("Type Annotation Priority", () => {
    const input = `<template>
  <span :class="theme">text</span>
</template>
<script lang="ts" setup>
const theme: 'light' | 'dark' = 'light'
</script>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: '<span class="light">text</span>',
      annotated:
        '<span data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="35" class="light" data-class-start-line="2" data-class-start-column="9" data-class-end-line="2" data-class-end-column="23">text</span>',
    });
    expect(output).toContainEqual({
      plain: '<span class="dark">text</span>',
      annotated:
        '<span data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="35" class="dark" data-class-start-line="2" data-class-start-column="9" data-class-end-line="2" data-class-end-column="23">text</span>',
    });
  });
});

describe("Template Permutation", () => {
  it("v-if / v-else", () => {
    const input = `<template>
  <div v-if="true">A</div>
  <div v-else>B</div>
</template>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: "<div>A</div>",
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="27">A</div>',
    });
    expect(output).toContainEqual({
      plain: "<div>B</div>",
      annotated:
        '<div data-start-line="3" data-start-column="3" data-end-line="3" data-end-column="22">B</div>',
    });
  });

  it("Implicit Else", () => {
    const input = `<template>
  <span v-if="loaded">Done</span>
</template>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: "<span>Done</span>",
      annotated:
        '<span data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="34">Done</span>',
    });
    expect(output).toContainEqual({
      plain: "",
      annotated: "",
    });
  });

  it("v-show", () => {
    const input = `<template>
  <div v-show="isOpen">Content</div>
</template>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: "<div>Content</div>",
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="37">Content</div>',
    });
    expect(output).toContainEqual({
      plain: "",
      annotated: "",
    });
  });

  it("<template> Unwrap", () => {
    const input = `<template>
  <div class="root">
    <template v-if="true">
      <span>Child</span>
    </template>
  </div>
</template>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: '<div class="root"><span>Child</span></div>',
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="6" data-end-column="9" class="root" data-class-start-line="2" data-class-start-column="8" data-class-end-line="2" data-class-end-column="20"><span data-start-line="4" data-start-column="7" data-end-line="4" data-end-column="25">Child</span></div>',
    });
    expect(output).toContainEqual({
      plain: '<div class="root"></div>',
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="6" data-end-column="9" class="root" data-class-start-line="2" data-class-start-column="8" data-class-end-line="2" data-class-end-column="20"></div>',
    });
  });
});

describe("Rendering & Injection", () => {
  it("Interpolation", () => {
    const input = `<template>
  <h1>{{ title }}</h1>
</template>
<script lang="ts" setup>
const title = "Hello"
</script>`;

    const output = bridge(input);

    expect(output).toHaveLength(1);
    expect(output[0]).toEqual({
      plain: "<h1>Hello</h1>",
      annotated:
        '<h1 data-start-line="2" data-start-column="3" data-end-line="2" data-end-column="23">Hello</h1>',
    });
  });

  it("v-for Known Array", () => {
    const input = `<template>
  <ul>
    <li v-for="tag in tags">{{ tag }}</li>
  </ul>
</template>
<script lang="ts" setup>
const tags = ["A", "B"]
</script>`;

    const output = bridge(input);

    expect(output).toHaveLength(2);
    expect(output).toContainEqual({
      plain: "<ul></ul>",
      annotated:
        '<ul data-start-line="2" data-start-column="3" data-end-line="4" data-end-column="8"></ul>',
    });
    expect(output).toContainEqual({
      plain: "<ul><li>A</li><li>B</li></ul>",
      annotated:
        '<ul data-start-line="2" data-start-column="3" data-end-line="4" data-end-column="8"><li data-start-line="3" data-start-column="5" data-end-line="3" data-end-column="43">A</li><li data-start-line="3" data-start-column="5" data-end-line="3" data-end-column="43">B</li></ul>',
    });
  });

  it("v-for Unknown Array", () => {
    const input = `<template>
  <div>
    <span v-for="item in unknownList">{{ item }}</span>
  </div>
</template>`;

    const output = bridge(input);

    expect(output).toHaveLength(3);
    expect(output).toContainEqual({
      plain: "<div></div>",
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="4" data-end-column="9"></div>',
    });
    expect(output).toContainEqual({
      plain: "<div><span>mock-item</span></div>",
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="4" data-end-column="9"><span data-start-line="3" data-start-column="5" data-end-line="3" data-end-column="56">mock-item</span></div>',
    });
    expect(output).toContainEqual({
      plain: "<div><span>mock-item</span><span>mock-item</span></div>",
      annotated:
        '<div data-start-line="2" data-start-column="3" data-end-line="4" data-end-column="9"><span data-start-line="3" data-start-column="5" data-end-line="3" data-end-column="56">mock-item</span><span data-start-line="3" data-start-column="5" data-end-line="3" data-end-column="56">mock-item</span></div>',
    });
  });
});
